import { EventEmitter } from 'events';
import { logger, aiLogger } from '@/utils/logger';
import config from '@/config';
import { InterviewMessage, AIChatStreamResponse } from '@/types';

/**
 * AI服务封装
 * 核心功能：
 * 1. HTTP API调用（OpenAI兼容接口）
 * 2. SSE流式输出
 * 3. 超时控制 + 重试机制
 * 4. 降级策略
 */

interface AIRequestConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface AIResponse {
  content: string;
  metadata: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    responseTime: number;
  };
}

export class AIService extends EventEmitter {
  private apiUrl: string;
  private apiKey: string;
  private defaultConfig: AIRequestConfig;

  constructor() {
    super();
    this.apiUrl = config.xinghuo.apiUrl;
    this.apiKey = config.xinghuo.apiKey;
    this.defaultConfig = {
      timeout: config.ai.timeoutChatFirstChar,
      maxRetries: config.ai.maxRetries,
      retryDelay: 1000,
    };
  }

  /**
   * 流式对话 - 核心方法
   * @param messages 历史消息
   * @param caseContext 病例上下文
   * @param onChunk 流式回调
   * @param onError 错误回调
   * @param onComplete 完成回调
   */
  async streamChat(
    messages: InterviewMessage[],
    caseContext: {
      title: string;
      chiefComplaint: string;
      presentIllness: string;
      diagnosis: string;
    },
    onChunk: (chunk: AIChatStreamResponse) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 构建系统提示词（患者角色扮演）
    const systemPrompt = this.buildPatientPrompt(caseContext);
    
    // 构建消息历史
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    // 记录AI调用日志
    aiLogger.info('AI chat request', {
      requestId,
      promptLength: JSON.stringify(chatMessages).length,
      messageCount: chatMessages.length,
      caseTitle: caseContext.title,
    });

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.defaultConfig.maxRetries) {
      try {
        await this.executeStreamRequest(
          requestId,
          chatMessages,
          startTime,
          onChunk,
          onComplete
        );
        return; // 成功完成
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        aiLogger.warn('AI chat error, retrying', {
          requestId,
          retryCount,
          error: lastError.message,
        });

        if (retryCount <= this.defaultConfig.maxRetries) {
          // 等待后重试
          await this.delay(this.defaultConfig.retryDelay * retryCount);
        }
      }
    }

    // 重试耗尽，触发降级
    aiLogger.error('AI chat failed after retries', {
      requestId,
      totalRetries: retryCount,
      error: lastError?.message,
    });

    // 返回降级响应
    this.emit('degraded', { requestId, error: lastError });
    onError(this.createDegradedError());
  }

  /**
   * 执行流式请求
   */
  private async executeStreamRequest(
    requestId: string,
    messages: Array<{ role: string; content: string }>,
    startTime: number,
    onChunk: (chunk: AIChatStreamResponse) => void,
    onComplete: () => void
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.defaultConfig.timeout);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: 'xinghuo-v3.5',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      // 处理SSE流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let firstCharReceived = false;
      let totalContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';
              
              if (content) {
                if (!firstCharReceived) {
                  const firstCharTime = Date.now() - startTime;
                  aiLogger.info('AI first char received', {
                    requestId,
                    firstCharTime,
                  });
                  firstCharReceived = true;
                }

                totalContent += content;
                onChunk({
                  content,
                  done: false,
                });
              }
            } catch (e) {
              // 忽略解析错误，继续处理
              logger.debug('SSE parse error', { line: trimmed });
            }
          }
        }
      }

      // 完成回调
      const totalTime = Date.now() - startTime;
      aiLogger.info('AI chat completed', {
        requestId,
        totalTime,
        contentLength: totalContent.length,
      });

      onChunk({
        content: '',
        done: true,
        metadata: {
          responseTime: totalTime,
        },
      });

      onComplete();

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI_RESPONSE_TIMEOUT');
      }
      throw error;
    }
  }

  /**
   * 构建患者角色提示词
   */
  private buildPatientPrompt(caseContext: {
    title: string;
    chiefComplaint: string;
    presentIllness: string;
    diagnosis: string;
  }): string {
    return `你是一位真实的患者，正在医院门诊就诊。请严格遵守以下规则：

【患者信息】
- 主诉：${caseContext.chiefComplaint}
- 现病史：${caseContext.presentIllness}
- 最终诊断：${caseContext.diagnosis}

【角色扮演规则】
1. 你是患者，不是医生。只回答患者知道的信息，不主动提供医学诊断。
2. 语气要自然、口语化，像真实的病人说话。
3. 如果医生问到你不知道的信息，诚实地说"我不太清楚"或"我没注意"。
4. 如果医生问到你没提到的症状，根据病情合理回答。
5. 可以适当表现出焦虑、痛苦等情绪，但不要过度。
6. 不要一次性说出所有信息，要等医生问了才说。
7. 如果医生问得不清楚，可以反问确认。
8. 绝对不要说出"根据医学知识""建议你做检查"等医生口吻的话。

【回答示例】
医生：您哪里不舒服？
患者：我胸口疼，从昨天下午开始的...

医生：疼痛是什么性质的？
患者：像有块大石头压着，闷闷的疼...

现在开始对话，你是这位患者。`;
  }

  /**
   * 创建降级错误
   */
  private createDegradedError(): Error {
    const error = new Error('AI_SERVICE_BUSY');
    (error as any).isDegraded = true;
    (error as any).userMessage = '服务繁忙，请稍后重试';
    return error;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const aiService = new AIService();