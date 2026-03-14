import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';

const router = Router();

// 演示登录
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // 演示模式：任何账号都可以登录
  const token = jwt.sign(
    { userId: 'demo-user', email: email || 'demo@medcase.ai', role: 'STUDENT' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: 'demo-user',
        email: email || 'demo@medcase.ai',
        name: '演示用户',
        role: 'STUDENT',
      },
    },
  });
});

// 获取当前用户
router.get('/me', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'demo-user',
      email: 'demo@medcase.ai',
      name: '演示用户',
      role: 'STUDENT',
    },
  });
});

export default router;