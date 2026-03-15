import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import { logger } from './utils/logger';
import healthRouter from './routes/health';

// 导入路由
import authRouter from './routes/auth';
import caseRouter from './routes/case';
// 导入 interview 路由
import interviewRouter from './routes/interview';
import aiRouter from './routes/ai';

const app = express();

// 安全中间件
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// 速率限制
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});
app.use(limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));

// 健康检查路由
app.use('/api/health', healthRouter);

// API路由
app.use('/api/auth', authRouter);
app.use('/api/cases', caseRouter);

// API路由 - interview
console.log('Loading interview router...');
app.use('/api/interviews', (req, res, next) => {
  console.log('Interview route hit:', req.method, req.path);
  interviewRouter(req, res, next);
});

app.use('/api/ai', aiRouter);

// 根路由
app.get('/', (_req, res) => {
  res.json({
    service: 'MedCase AI Backend',
    version: '1.0.0',
    status: 'running',
  });
});

// 调试路由 - 列出dist目录内容
import fs from 'fs';
import path from 'path';
app.get('/debug/files', (_req, res) => {
  try {
    const distPath = path.join(__dirname, '..', 'dist');
    const routesPath = path.join(distPath, 'routes');
    
    // 读取index.js内容，检查是否包含interview
    const indexPath = path.join(distPath, 'index.js');
    const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
    const hasInterview = indexContent.includes('interview');
    
    const files = {
      distExists: fs.existsSync(distPath),
      routesExists: fs.existsSync(routesPath),
      indexHasInterview: hasInterview,
      indexContentPreview: indexContent.substring(0, 2000),
    };
    
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 旧版调试路由
app.get('/debug/files-old', (_req, res) => {
  try {
    const distPath = path.join(__dirname, '..', 'dist');
    const routesPath = path.join(distPath, 'routes');
    
    const files = {
      distExists: fs.existsSync(distPath),
      routesExists: fs.existsSync(routesPath),
      distFiles: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
      routesFiles: fs.existsSync(routesPath) ? fs.readdirSync(routesPath) : [],
    };
    
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 404处理
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
    },
  });
});

// 错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
  });
});

// 启动服务器
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} (v2)`, {
    port: PORT,
    env: config.nodeEnv,
  });
});

export default app;