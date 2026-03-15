import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://virtual-telemedicine-assistant-production.up.railway.app';

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
      });

      try {
        const token = localStorage.getItem('token') || 'demo-token';
        const response = await fetch(`${API_BASE_URL}/api/interviews/${interviewId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error('发送消息失败');
        }

        const data = await response.json();
        
        set({
          messages: [...get().messages, {
            id: data.data.message.id,
            role: data.data.message.role,
            content: data.data.message.content,
            timestamp: new Date(data.data.message.timestamp).getTime(),
          }],
          status: 'chatting',
        });
      } catch (error) {
        set({ error: (error as Error).message });
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