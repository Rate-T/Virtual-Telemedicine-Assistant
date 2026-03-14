import { create } from 'zustand';

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
  setError: (error: string | null) => void;
  reset: () => void;
}

// 模拟患者回复
const PATIENT_REPLIES = [
  '我胸口疼得厉害，像被石头压着一样...',
  '大概有两个小时了，一开始只是有点闷，现在越来越疼。',
  '疼的时候向左肩膀和胳膊放射，还出冷汗。',
  '我有高血压，平时血压控制得不太好。',
  '我抽烟，一天大概一包。',
  '没有糖尿病，血脂有点高。',
  '父亲有冠心病，做过支架手术。',
];

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
      
      // 模拟创建问诊
      setTimeout(() => {
        set({
          interviewId: `interview-${Date.now()}`,
          caseId,
          caseTitle,
          messages: [
            {
              id: `msg-${Date.now()}`,
              role: 'patient',
              content: '医生您好，我最近胸口不舒服...',
              timestamp: Date.now(),
            },
          ],
          status: 'chatting',
          error: null,
        });
      }, 500);
    },

    sendMessage: async (content: string) => {
      const { messages } = get();

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

      // 模拟AI回复（带打字效果）
      setTimeout(() => {
        const reply = PATIENT_REPLIES[Math.floor(Math.random() * PATIENT_REPLIES.length)];
        const aiMessage: Message = {
          id: `msg-${Date.now()}-patient`,
          role: 'patient',
          content: reply,
          timestamp: Date.now(),
        };
        set({
          messages: [...get().messages, aiMessage],
          status: 'chatting',
        });
      }, 1000);
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