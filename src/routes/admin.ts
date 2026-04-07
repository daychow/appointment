import { Hono } from 'hono';
import type { Env } from '../index';

const adminRoutes = new Hono<{ Bindings: Env }>();

// Simple password middleware
const checkPassword = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const password = authHeader.slice(7);
  const config = await c.env.DB.prepare(
    'SELECT value FROM admin_config WHERE key = ?'
  ).bind('password').first();
  
  if (!config || config.value !== password) {
    return c.json({ error: 'Invalid password' }, 401);
  }
  
  await next();
};

// Login
adminRoutes.post('/login', async (c) => {
  const { password } = await c.req.json();
  
  const config = await c.env.DB.prepare(
    'SELECT value FROM admin_config WHERE key = ?'
  ).bind('password').first();
  
  if (!config || config.value !== password) {
    return c.json({ error: 'Invalid password' }, 401);
  }
  
  return c.json({ success: true });
});

// Get all bookings
adminRoutes.get('/bookings', checkPassword, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, a.date as slot_date, a.start_time, a.end_time
     FROM bookings b
     LEFT JOIN availability a ON b.availability_id = a.id
     ORDER BY b.booking_date DESC, b.start_time DESC`
  ).all();
  
  return c.json(results);
});

// Update booking
adminRoutes.put('/bookings/:id', checkPassword, async (c) => {
  const id = c.req.param('id');
  const { customer_name, customer_phone, status } = await c.req.json();
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (customer_name !== undefined) {
    updates.push('customer_name = ?');
    values.push(customer_name);
  }
  if (customer_phone !== undefined) {
    updates.push('customer_phone = ?');
    values.push(customer_phone);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }
  
  values.push(id);
  
  await c.env.DB.prepare(
    `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  return c.json({ success: true });
});

// Cancel booking
adminRoutes.delete('/bookings/:id', checkPassword, async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare(
    `UPDATE bookings SET status = 'cancelled' WHERE id = ?`
  ).bind(id).run();
  
  return c.json({ success: true });
});

// Get availability settings
adminRoutes.get('/availability', checkPassword, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM availability ORDER BY date DESC, start_time`
  ).all();
  
  return c.json(results);
});

// Add availability slot (single)
adminRoutes.post('/availability', checkPassword, async (c) => {
  const { date, start_time, end_time } = await c.req.json();
  
  if (!date || !start_time || !end_time) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    `INSERT INTO availability (date, start_time, end_time) VALUES (?, ?, ?)`
  ).bind(date, start_time, end_time).run();
  
  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

// Batch generate availability slots
adminRoutes.post('/availability/batch', checkPassword, async (c) => {
  const { 
    start_date, 
    end_date, 
    start_time, 
    end_time, 
    duration_minutes,
    exclude_weekdays,
    exclude_dates,
    exclude_time_ranges
  } = await c.req.json();
  
  if (!start_date || !end_date || !start_time || !end_time || !duration_minutes) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  const slots = [];
  const currentDate = new Date(start_date);
  const endDate = new Date(end_date);
  const excludeDatesSet = new Set(exclude_dates || []);
  const excludeWeekdays = exclude_weekdays || []; // 0=Sun, 1=Mon, ..., 6=Sat
  const excludeRanges = exclude_time_ranges || []; // [{start: "12:00", end: "14:00"}]
  
  // Generate slots for each day
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const weekday = currentDate.getDay();
    
    // Skip excluded weekdays
    if (!excludeWeekdays.includes(weekday)) {
      // Skip excluded specific dates
      if (!excludeDatesSet.has(dateStr)) {
        // Generate time slots for this day
        let currentTime = parseTime(start_time);
        const dayEndTime = parseTime(end_time);
        
        while (currentTime < dayEndTime) {
          const slotStart = formatTime(currentTime);
          const slotEndTime = new Date(currentTime.getTime() + duration_minutes * 60000);
          const slotEnd = formatTime(slotEndTime);
          
          // Check if this slot is within excluded time ranges
          let isExcluded = false;
          for (const range of excludeRanges) {
            if (isTimeInRange(slotStart, slotEnd, range.start, range.end)) {
              isExcluded = true;
              break;
            }
          }
          
          // Check if slot end exceeds day end time
          if (slotEndTime > dayEndTime) {
            break;
          }
          
          if (!isExcluded) {
            slots.push({
              date: dateStr,
              start_time: slotStart,
              end_time: slotEnd
            });
          }
          
          currentTime = slotEndTime;
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Insert all slots
  const insertedIds = [];
  for (const slot of slots) {
    try {
      const result = await c.env.DB.prepare(
        `INSERT INTO availability (date, start_time, end_time) VALUES (?, ?, ?)`
      ).bind(slot.date, slot.start_time, slot.end_time).run();
      insertedIds.push(result.meta.last_row_id);
    } catch (e) {
      // Ignore duplicate errors
    }
  }
  
  return c.json({ 
    success: true, 
    generated_count: insertedIds.length,
    total_possible: slots.length 
  }, 201);
});

function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function isTimeInRange(slotStart: string, slotEnd: string, excludeStart: string, excludeEnd: string): boolean {
  return slotStart < excludeEnd && slotEnd > excludeStart;
}

// Delete availability slot
adminRoutes.delete('/availability/:id', checkPassword, async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare(
    `DELETE FROM availability WHERE id = ?`
  ).bind(id).run();
  
  return c.json({ success: true });
});

// Change password
adminRoutes.put('/password', checkPassword, async (c) => {
  const { new_password } = await c.req.json();
  
  if (!new_password || new_password.length < 4) {
    return c.json({ error: 'Password must be at least 4 characters' }, 400);
  }
  
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO admin_config (key, value) VALUES ('password', ?)`
  ).bind(new_password).run();
  
  return c.json({ success: true });
});

export { adminRoutes };
