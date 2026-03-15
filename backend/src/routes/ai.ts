import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// AI聊天代理接口
router.post('/chat', async (req, res) => {
  const { messages, config } = req.body;
  
  if (!config || !config.apiUrl || !config.apiKey) {
    return res.status(400).json({
      success: false,
      error: { message: '缺少AI配置，请先在设置中配置API' },
    });
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'generalv3.5',
        messages: messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API错误: ${error}`);
    }

    const data = await response.json();
    
    res.json({
      success: true,
      data: {
        content: data.choices?.[0]?.message?.content || '抱歉，我没有理解您的问题。',
      },
    });
  } catch (error) {
    console.error('AI调用失败:', error);
    res.status(500).json({
      success: false,
      error: { message: (error as Error).message },
    });
  }
});

export default router;