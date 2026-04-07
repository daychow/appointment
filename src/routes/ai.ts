import { Hono } from 'hono';
import type { Env } from '../index';

const aiRoutes = new Hono<{ Bindings: Env }>();

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

// Get recent AI analysis
aiRoutes.get('/analysis', checkPassword, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ai_analysis ORDER BY created_at DESC LIMIT 1`
  ).all();
  
  return c.json(results[0] || null);
});

// Trigger AI analysis
aiRoutes.post('/analyze', checkPassword, async (c) => {
  console.log('AI analyze endpoint called');
  try {
    // Get all bookings data
    const { results: bookings } = await c.env.DB.prepare(
      `SELECT b.*, a.date as slot_date, a.start_time, a.end_time
       FROM bookings b
       LEFT JOIN availability a ON b.availability_id = a.id
       WHERE b.status = 'active'
       ORDER BY b.booking_date DESC, b.start_time DESC
       LIMIT 100`
    ).all();
    
    console.log('Found bookings:', bookings?.length || 0);
    
    if (!bookings || bookings.length === 0) {
      return c.json({ error: 'No booking data to analyze' }, 400);
    }
    
    // Get OpenRouter API key
    const apiKeyConfig = await c.env.DB.prepare(
      'SELECT value FROM ai_config WHERE key = ?'
    ).bind('openrouter_api_key').first();
    
    const apiKey = apiKeyConfig?.value || c.env.OPENROUTER_API_KEY;
    
    console.log('API Key exists:', !!apiKey);
    
    if (!apiKey) {
      return c.json({ error: 'OpenRouter API key not configured' }, 500);
    }
    
    // Prepare data for AI
    const bookingsData = bookings.map((b: any) => ({
      date: b.booking_date || b.slot_date,
      time: b.start_time + ' - ' + b.end_time,
      customer: b.customer_name
    }));
    
    // Generate summary
    const summaryPrompt = `你是一個預約管理助手。請根據以下預約數據生成預約摘要：

預約數據（JSON格式）：
${JSON.stringify(bookingsData, null, 2)}

請生成：
1. 總預約數
2. 時間分佈（上午/下午/晚上）
3. 客戶姓名列表
4. 任何需要注意的事項

用繁體中文回答，格式簡潔明瞭，使用 Markdown。`;

    const insightsPrompt = `你是一個數據分析專家。請分析以下預約數據：

預約數據（JSON格式）：
${JSON.stringify(bookingsData, null, 2)}

請分析：
1. 最受歡迎的時段
2. 客戶偏好（平日 vs 週末，上午 vs 下午）
3. 時段利用率建議
4. 未來預測

用繁體中文回答，提供 actionable insights，使用 Markdown。`;
    
    // Call OpenRouter API
    const model = 'qwen/qwen3-next-80b-a3b-instruct:free';
    
    console.log('Calling OpenRouter API...');
    
    const [summaryResponse, insightsResponse] = await Promise.all([
      callOpenRouter(apiKey, model, summaryPrompt),
      callOpenRouter(apiKey, model, insightsPrompt)
    ]);
    
    console.log('OpenRouter responses received');
    
    const content = JSON.stringify({
      summary: summaryResponse,
      insights: insightsResponse,
      generated_at: new Date().toISOString(),
      data_count: bookings.length
    });
    
    // Save to database
    const result = await c.env.DB.prepare(
      `INSERT INTO ai_analysis (analysis_type, content, data_snapshot) VALUES (?, ?, ?)`
    ).bind('combined', content, JSON.stringify({ count: bookings.length })).run();
    
    return c.json({
      success: true,
      id: result.meta.last_row_id,
      summary: summaryResponse,
      insights: insightsResponse
    });
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return c.json({ error: 'Failed to generate analysis', details: String(error) }, 500);
  }
});

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
  console.log('Calling OpenRouter with model:', model);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://appointment-system.workers.dev',
      'X-Title': 'Appointment System AI'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  console.log('OpenRouter response status:', response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter error:', error);
    throw new Error(`OpenRouter API error: ${error}`);
  }
  
  const data = await response.json() as any;
  console.log('OpenRouter response received, content length:', data.choices?.[0]?.message?.content?.length || 0);
  return data.choices?.[0]?.message?.content || 'No response from AI';
}

export { aiRoutes };
