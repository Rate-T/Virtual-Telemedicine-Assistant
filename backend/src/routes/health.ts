import { Router } from 'express';

const router = Router();

// 健康检查端点
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'medcase-ai-backend',
    version: '1.0.0',
  });
});

export default router;