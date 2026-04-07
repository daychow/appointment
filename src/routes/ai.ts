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
  console.log('=== AI ANALYZE START ===');
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
    
    console.log('Found bookings count:', bookings?.length || 0);
    console.log('Bookings data:', JSON.stringify(bookings, null, 2));
    
    if (!bookings || bookings.length === 0) {
      return c.json({ error: 'No booking data to analyze' }, 400);
    }
    
    // Get OpenRouter API key
    // Priority: 1. Environment variable 2. Database config
    let apiKey = c.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      const apiKeyConfig = await c.env.DB.prepare(
        'SELECT value FROM ai_config WHERE key = ?'
      ).bind('openrouter_api_key').first();
      apiKey = apiKeyConfig?.value;
    }
    
    console.log('API Key source:', c.env.OPENROUTER_API_KEY ? 'environment' : (apiKey ? 'database' : 'none'));
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
    
    // Single prompt for both summary and insights
    const combinedPrompt = `你是一個預約管理助手和數據分析專家。請根據以下預約數據，生成預約摘要和智能分析：

預約數據（JSON格式）：
${JSON.stringify(bookingsData, null, 2)}

請用繁體中文回答，格式如下：

## 預約摘要
1. 總預約數：[數字]
2. 時間分佈：[上午/下午/晚上的分佈]
3. 客戶列表：[姓名]
4. 注意事項：[如有]

## 智能分析
1. 最受歡迎時段：[分析]
2. 客戶偏好：[平日/週末，上午/下午等]
3. 時段利用建議：[建議]
4. 未來預測：[預測]`;
    
    // Call OpenRouter API once
    const model = 'stepfun/step-3.5-flash:free';
    
    console.log('Calling OpenRouter API...');
    
    const aiResponse = await callOpenRouter(apiKey, model, combinedPrompt);
    
    console.log('OpenRouter response received');
    
    // Parse response to separate summary and insights
    let summary = aiResponse;
    let insights = '';
    
    // Try to split by "## 智能分析"
    const splitMarker = '## 智能分析';
    const splitIndex = aiResponse.indexOf(splitMarker);
    if (splitIndex !== -1) {
      summary = aiResponse.substring(0, splitIndex).trim();
      insights = aiResponse.substring(splitIndex + splitMarker.length).trim();
    }
    
    const content = JSON.stringify({
      summary: summary,
      insights: insights || aiResponse,
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
      summary: summary,
      insights: insights
    });
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return c.json({ error: 'Failed to generate analysis', details: String(error) }, 500);
  }
});

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
  console.log('=== OPENROUTER API CALL ===');
  console.log('Model:', model);
  console.log('Prompt length:', prompt.length);
  console.log('Prompt (first 500 chars):', prompt.substring(0, 500));
  
  const requestBody = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://appointment-system.workers.dev',
      'X-Title': 'Appointment System AI'
    },
    body: JSON.stringify(requestBody)
  });
  
  console.log('Response status:', response.status);
  console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers)));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Response error body:', errorText);
    throw new Error(`OpenRouter API error: ${errorText}`);
  }
  
  const data = await response.json() as any;
  console.log('=== RESPONSE DATA ===');
  console.log('Full response:', JSON.stringify(data, null, 2));
  console.log('Choices:', data.choices);
  console.log('First choice:', data.choices?.[0]);
  console.log('Message:', data.choices?.[0]?.message);
  console.log('Content:', data.choices?.[0]?.message?.content);
  console.log('Content length:', data.choices?.[0]?.message?.content?.length);
  console.log('=======================');
  
  const content = data.choices?.[0]?.message?.content;
  
  if (!content || content.trim() === '') {
    console.error('Empty content received from AI');
    throw new Error('AI returned empty response');
  }
  
  return content;
}

export { aiRoutes };
