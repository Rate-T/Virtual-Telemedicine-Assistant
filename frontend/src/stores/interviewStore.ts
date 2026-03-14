import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'patient' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface InterviewState {
  interviewId: string | null;
  caseId: string | null;
  caseTitle: string;
  messages: Message[];
  status: 'idle' | 'loading' | 'chatting' | 'submitting' | 'completed';
  error: string | null;
  isConnected: boolean;
  reconnectAttempt: number;
}

interface InterviewActions {
  startInterview: (caseId: string, caseTitle: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  appendStreamContent: (content: string) => void;
  finishStreaming: () => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  reconnect: () => void;
  reset: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useInterviewStore = create<InterviewState & InterviewActions>()(
  persist(
    (set, get) => ({
      // State
      interviewId: null,
      caseId: null,
      caseTitle: '',
      messages: [],
      status: 'idle',
      error: null,
      isConnected: true,
      reconnectAttempt: 0,

      // Actions
      startInterview: async (caseId: string, caseTitle: string) => {
        set({ status: 'loading', error: null });
        
        try {
          const token = localStorage.getItem('token') || 'demo-token';
          const response = await fetch(`${API_BASE_URL}/api/interviews`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ caseId, mode: 'FREE' }),
          });

          if (!response.ok) {
            throw new Error('创建问诊失败');
          }

          const data = await response.json();
          
          set({
            interviewId: data.data.id,
            caseId,
            caseTitle,
            messages: data.data.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp).getTime(),
            })),
            status: 'chatting',
            error: null,
          });
        } catch (error) {
          set({ status: 'idle', error: (error as Error).message });
        }
      },

      sendMessage: async (content: string) => {
        const { interviewId, messages } = get();
        if (!interviewId) return;

        // 添加用户消息
        const userMessage: Message = {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content,
          timestamp: Date.now(),
        };

        set({
          messages: [...messages, userMessage],
          status: 'chatting',
          error: null,
        });

        // 创建AI消息占位
        const aiMessageId = `msg-${Date.now()}-ai`;
        const aiMessage: Message = {
          id: aiMessageId,
          role: 'patient',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        };

        set({
          messages: [...get().messages, aiMessage],
        });

        // 发送SSE请求
        try {
          const token = localStorage.getItem('token') || 'demo-token';
          const eventSource = new EventSource(
            `${API_BASE_URL}/api/interviews/${interviewId}/chat?message=${encodeURIComponent(content)}&token=${token}`
          );

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.done) {
                eventSource.close();
                get().finishStreaming();
              } else {
                get().appendStreamContent(data.content);
              }
            } catch (e) {
              // 忽略解析错误
            }
          };

          eventSource.onerror = () => {
            eventSource.close();
            set({ error: '连接中断，请重试', isConnected: false });
          };
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      appendStreamContent: (content: string) => {
        const { messages } = get();
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.isStreaming) {
          const updatedMessages = [...messages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + content,
          };
          set({ messages: updatedMessages });
        }
      },

      finishStreaming: () => {
        const { messages } = get();
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.isStreaming) {
          const updatedMessages = [...messages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            isStreaming: false,
          };
          set({ messages: updatedMessages, status: 'chatting' });
        }
      },

      setError: (error: string | null) => set({ error }),
      
      setConnected: (connected: boolean) => set({ isConnected: connected }),
      
      reconnect: () => {
        const { reconnectAttempt } = get();
        set({ 
          isConnected: true, 
          reconnectAttempt: reconnectAttempt + 1,
          error: null 
        });
      },
      
      reset: () => set({
        interviewId: null,
        caseId: null,
        caseTitle: '',
        messages: [],
        status: 'idle',
        error: null,
        isConnected: true,
        reconnectAttempt: 0,
      }),
    }),
    {
      name: 'interview-storage',
      partialize: (state) => ({
        interviewId: state.interviewId,
        caseId: state.caseId,
        caseTitle: state.caseTitle,
        messages: state.messages,
        status: state.status,
      }),
    }
  )
);