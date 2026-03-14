import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 存储问诊会话（内存存储，生产环境应使用数据库）
const interviews = new Map();

// 创建问诊
router.post('/', (req, res) => {
  const { caseId, mode = 'FREE' } = req.body;
  
  const interviewId = uuidv4();
  const interview = {
    id: interviewId,
    caseId,
    mode,
    status: 'IN_PROGRESS',
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: 'patient',
        content: '医生您好，我最近身体不太舒服...',
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  };
  
  interviews.set(interviewId, interview);
  
  res.json({
    success: true,
    data: interview,
  });
});

// 获取问诊详情
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const interview = interviews.get(id);
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: { code: 'INTERVIEW_NOT_FOUND', message: '问诊不存在' },
    });
    return;
  }
  
  res.json({
    success: true,
    data: interview,
  });
});

// 发送消息（简化版，返回模拟回复）
router.post('/:id/messages', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  const interview = interviews.get(id);
  if (!interview) {
    res.status(404).json({
      success: false,
      error: { code: 'INTERVIEW_NOT_FOUND', message: '问诊不存在' },
    });
    return;
  }
  
  // 添加用户消息
  interview.messages.push({
    id: `msg-${Date.now()}-user`,
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  });
  
  // 模拟AI回复
  const replies = [
    '我胸口疼得厉害，像被石头压着一样...',
    '大概有两个小时了，一开始只是有点闷，现在越来越疼。',
    '疼的时候向左肩膀和胳膊放射，还出冷汗。',
    '我有高血压，平时血压控制得不太好。',
    '我抽烟，一天大概一包。',
  ];
  
  const reply = replies[Math.floor(Math.random() * replies.length)];
  
  interview.messages.push({
    id: `msg-${Date.now()}-patient`,
    role: 'patient',
    content: reply,
    timestamp: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    data: {
      message: interview.messages[interview.messages.length - 1],
    },
  });
});

// 提交诊断
router.post('/:id/diagnosis', (req, res) => {
  const { id } = req.params;
  const { diagnosis, diagnosisBasis } = req.body;
  
  const interview = interviews.get(id);
  if (!interview) {
    res.status(404).json({
      success: false,
      error: { code: 'INTERVIEW_NOT_FOUND', message: '问诊不存在' },
    });
    return;
  }
  
  interview.status = 'COMPLETED';
  interview.diagnosis = diagnosis;
  interview.diagnosisBasis = diagnosisBasis;
  interview.completedAt = new Date().toISOString();
  
  // 模拟评分
  const scores = {
    completeness: 85,
    logic: 80,
    communication: 90,
    diagnosis: 75,
    efficiency: 85,
    total: 83,
  };
  
  res.json({
    success: true,
    data: {
      interview,
      scores,
      feedback: '问诊整体表现良好，建议进一步学习心电图解读。',
      suggestions: ['加强体格检查', '注意鉴别诊断'],
    },
  });
});

export default router;