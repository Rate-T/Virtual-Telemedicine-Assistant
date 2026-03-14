import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import { logger } from './utils/logger';
import healthRouter from './routes/health';

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

// 根路由
app.get('/', (_req, res) => {
  res.json({
    service: 'MedCase AI Backend',
    version: '1.0.0',
    status: 'running',
  });
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
  logger.info(`Server started on port ${PORT}`, {
    port: PORT,
    env: config.nodeEnv,
  });
});

export default app;