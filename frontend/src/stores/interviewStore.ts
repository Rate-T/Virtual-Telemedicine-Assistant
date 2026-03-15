import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

// API地址 - 生产环境使用固定地址
const API_BASE_URL = 'https://virtual-telemedicine-assistant-production.up.railway.app';

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
}

interface InterviewActions {
  startInterview: (caseId: string, caseTitle: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  submitDiagnosis: (diagnosis: string, basis: string) => Promise<any>;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState & InterviewActions>()(
  (set, get) => ({
    // State
    interviewId: null,
    caseId: null,
    caseTitle: '',
    messages: [],
    status: 'idle',
    error: null,
    isConnected: true,

    // Actions
    startInterview: async (caseId: string, caseTitle: string) => {
      set({ status: 'loading', error: null });
      
      try {
        console.log('API_BASE_URL:', API_BASE_URL);
        const token = localStorage.getItem('token') || 'demo-token';
        const url = `${API_BASE_URL}/api/interviews`;
        console.log('Fetching URL:', url);
        const response = await fetch(url, {
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
      const { interviewId, messages, caseTitle } = get();
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
      });

      try {
        // 获取AI配置
        const settings = JSON.parse(localStorage.getItem('medcase-settings') || '{}');
        const aiConfig = settings?.state?.aiConfig;
        
        if (!aiConfig || !aiConfig.apiKey) {
          // 没有配置，使用模拟回复
          setTimeout(() => {
            const mockReplies = [
              '我胸口疼得厉害，像被石头压着一样...',
              '大概有两个小时了，一开始只是有点闷。',
              '我有高血压，平时血压控制得不太好。',
            ];
            const reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
            
            set({
              messages: [...get().messages, {
                id: `msg-${Date.now()}-patient`,
                role: 'patient',
                content: reply,
                timestamp: Date.now(),
              }],
              status: 'chatting',
            });
          }, 1000);
          return;
        }

        // 调用后端AI接口
        const token = localStorage.getItem('token') || 'demo-token';
        const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            config: aiConfig,
            messages: [
              {
                role: 'system',
                content: `你是一个医学教学用的虚拟患者。你正在扮演一个${caseTitle}的患者。请根据医生的提问，以患者的身份回答。回答要真实、自然，符合病情。`,
              },
              ...get().messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
              })),
            ],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'AI调用失败');
        }

        const data = await response.json();
        
        set({
          messages: [...get().messages, {
            id: `msg-${Date.now()}-patient`,
            role: 'patient',
            content: data.data.content,
            timestamp: Date.now(),
          }],
          status: 'chatting',
        });
      } catch (error) {
        set({ 
          messages: [...get().messages, {
            id: `msg-${Date.now()}-patient`,
            role: 'patient',
            content: `（AI调用失败：${(error as Error).message}。请检查设置中的API配置。）`,
            timestamp: Date.now(),
          }],
          status: 'chatting',
        });
      }
    },

    submitDiagnosis: async (diagnosis: string, basis: string) => {
      const { interviewId } = get();
      if (!interviewId) return;

      try {
        const token = localStorage.getItem('token') || 'demo-token';
        const response = await fetch(`${API_BASE_URL}/api/interviews/${interviewId}/diagnosis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ diagnosis, diagnosisBasis: basis }),
        });

        if (!response.ok) {
          throw new Error('提交诊断失败');
        }

        const data = await response.json();
        set({ status: 'completed' });
        return data.data;
      } catch (error) {
        set({ error: (error as Error).message });
        return null;
      }
    },

    setError: (error: string | null) => set({ error }),
    
    reset: () => set({
      interviewId: null,
      caseId: null,
      caseTitle: '',
      messages: [],
      status: 'idle',
      error: null,
      isConnected: true,
    }),
  })
);