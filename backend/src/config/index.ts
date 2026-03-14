import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// 配置验证
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  // 服务器
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // 数据库
  databaseUrl: process.env.DATABASE_URL!,
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // 星火大模型
  xinghuo: {
    apiUrl: process.env.XINGHUO_API_URL || 'https://api.xinghuo.xfyun.cn/v1/chat/completions',
    apiKey: process.env.XINGHUO_API_KEY || '',
    appId: process.env.XINGHUO_APP_ID || '',
    apiSecret: process.env.XINGHUO_API_SECRET || '',
  },
  
  // AI服务配置
  ai: {
    timeoutCaseGenerate: parseInt(process.env.AI_TIMEOUT_CASE_GENERATE || '30000', 10),
    timeoutChatFirstChar: parseInt(process.env.AI_TIMEOUT_CHAT_FIRST_CHAR || '2000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '1', 10),
  },
  
  // 日志
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // 速率限制
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};

export default config;