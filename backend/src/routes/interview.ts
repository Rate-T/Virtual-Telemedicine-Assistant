import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { aiService } from '../services/ai.service';

const router = Router();

// 存储问诊会话
const interviews = new Map();

// 创建问诊
router.post('/', async (req, res) => {
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

// 发送消息 - 调用AI生成回复
router.post('/:id/messages', async (req, res) => {
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

  try {
    // 简化处理：直接返回一个基于上下文的回复
    const _context = interview.messages.slice(-3).map((m: any) => m.content).join(' ');
    
    // 根据问题类型生成相关回复
    let reply = '';
    if (content.includes('疼') || content.includes('痛')) {
      reply = '胸口疼得厉害，像被石头压着一样，向左肩膀放射。';
    } else if (content.includes('多久') || content.includes('时间')) {
      reply = '大概有两个小时了，一开始只是有点闷，现在越来越疼。';
    } else if (content.includes('血压') || content.includes('病史')) {
      reply = '我有高血压5年了，平时血压控制得不太好，大概在150/90左右。';
    } else if (content.includes('抽烟') || content.includes('烟')) {
      reply = '我抽烟，一天大概一包，抽了有10年了。';
    } else if (content.includes('家族') || content.includes('父亲') || content.includes('母亲')) {
      reply = '父亲有冠心病，做过支架手术，母亲有高血压。';
    } else {
      reply = '医生，您还需要了解什么情况？我会如实告诉您。';
    }
    
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
  } catch (error) {
    // 如果AI调用失败，返回默认回复
    interview.messages.push({
      id: `msg-${Date.now()}-patient`,
      role: 'patient',
      content: '医生，我不太明白您的意思，能再说清楚一点吗？',
      timestamp: new Date().toISOString(),
    });
    
    res.json({
      success: true,
      data: {
        message: interview.messages[interview.messages.length - 1],
      },
    });
  }
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