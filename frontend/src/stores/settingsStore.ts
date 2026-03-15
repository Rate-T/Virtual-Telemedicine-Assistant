import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AIConfig {
  provider: 'xinghuo' | 'openai' | 'custom';
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface SettingsState {
  aiConfig: AIConfig;
}

interface SettingsActions {
  setAIConfig: (config: Partial<AIConfig>) => void;
}

const defaultConfig: AIConfig = {
  provider: 'xinghuo',
  apiUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
  apiKey: '',
  model: 'generalv3.5',
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      aiConfig: defaultConfig,
      
      setAIConfig: (config) => set((state) => ({
        aiConfig: { ...state.aiConfig, ...config },
      })),
    }),
    {
      name: 'medcase-settings',
    }
  )
);