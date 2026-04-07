import { Hono } from 'hono';
import type { Env } from '../index';

const publicRoutes = new Hono<{ Bindings: Env }>();

// Get available slots for a date
publicRoutes.get('/availability', async (c) => {
  const date = c.req.query('date');
  if (!date) {
    return c.json({ error: 'Date required' }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM availability 
     WHERE date = ? AND is_available = 1
     ORDER BY start_time`
  ).bind(date).all();

  // Check which slots are already booked
  const availableSlots = [];
  for (const slot of results || []) {
    const { results: bookings } = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE availability_id = ? AND status = 'active'`
    ).bind(slot.id).all();
    
    if ((bookings?.[0]?.count as number) === 0) {
      availableSlots.push(slot);
    }
  }

  return c.json(availableSlots);
});

// Create booking
publicRoutes.post('/bookings', async (c) => {
  const { availability_id, customer_name, customer_phone } = await c.req.json();

  if (!availability_id || !customer_name || !customer_phone) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Get availability details
  const slot = await c.env.DB.prepare(
    'SELECT * FROM availability WHERE id = ?'
  ).bind(availability_id).first();

  if (!slot) {
    return c.json({ error: 'Slot not found' }, 404);
  }

  // Check if already booked
  const { results: existing } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE availability_id = ? AND status = 'active'`
  ).bind(availability_id).all();

  if ((existing?.[0]?.count as number) > 0) {
    return c.json({ error: 'Slot already booked' }, 409);
  }

  // Create booking
  const result = await c.env.DB.prepare(
    `INSERT INTO bookings (availability_id, booking_date, start_time, end_time, customer_name, customer_phone)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    availability_id,
    slot.date,
    slot.start_time,
    slot.end_time,
    customer_name,
    customer_phone
  ).run();

  return c.json({ 
    success: true, 
    booking_id: result.meta.last_row_id,
    booking: {
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      customer_name,
      customer_phone
    }
  }, 201);
});

// Get booking by ID
publicRoutes.get('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  
  const booking = await c.env.DB.prepare(
    `SELECT * FROM bookings WHERE id = ?`
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  return c.json(booking);
});

export { publicRoutes };
