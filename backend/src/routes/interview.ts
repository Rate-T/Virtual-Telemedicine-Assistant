import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generatePatientPrompt, generateContextualReply, CaseData } from '../services/patientRole';

const router = Router();

// 存储问诊会话
const interviews = new Map();

// 病例数据（模拟数据库）
const casesData: Map<string, CaseData> = new Map([
  ['case-1', {
    id: 'case-1',
    title: '35岁男性胸痛待查',
    chiefComplaint: '胸痛2小时',
    presentIllness: '患者2小时前无明显诱因出现胸痛，位于胸骨后，呈压榨性，向左肩放射，伴大汗、恶心。',
    pastHistory: '高血压病史5年，吸烟史10年。',
    personalHistory: '吸烟10年，每天约20支。',
    familyHistory: '父亲有冠心病史。',
    physicalExam: 'BP 160/95mmHg，HR 98次/分，心肺听诊未见明显异常。',
    auxiliaryExam: '心电图：V1-V4导联ST段抬高。心肌酶：CK-MB 45U/L，cTnI 2.5ng/mL。',
    diagnosis: '急性前壁心肌梗死',
  }],
  ['case-2', {
    id: 'case-2',
    title: '28岁女性腹痛待查',
    chiefComplaint: '右下腹痛12小时',
    presentIllness: '患者12小时前出现右下腹疼痛，初为隐痛，后转为持续性疼痛，伴恶心，无呕吐，无发热。',
    pastHistory: '既往体健。',
    personalHistory: '无特殊。',
    familyHistory: '无特殊。',
    physicalExam: 'T 37.2℃，右下腹麦氏点压痛、反跳痛明显。',
    auxiliaryExam: '血常规：WBC 12.5×10^9/L，N 85%。腹部B超：阑尾增粗，周围积液。',
    diagnosis: '急性阑尾炎',
  }],
  ['case-3', {
    id: 'case-3',
    title: '6岁儿童发热咳嗽',
    chiefComplaint: '发热3天，咳嗽2天',
    presentIllness: '患儿3天前出现发热，体温最高39.5℃，2天前出现咳嗽，为阵发性干咳，无喘息，无呼吸困难。',
    pastHistory: '既往体健，按时接种疫苗。',
    personalHistory: '无特殊。',
    familyHistory: '无特殊。',
    physicalExam: 'T 38.8℃，R 32次/分，咽充血，双肺呼吸音粗，可闻及散在湿啰音。',
    auxiliaryExam: '血常规：WBC 11.2×10^9/L，N 65%，L 30%。胸片：右下肺斑片状阴影。',
    diagnosis: '支气管肺炎',
  }],
]);

// 获取所有问诊（调试用）
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Interview API is working',
      count: interviews.size,
    },
  });
});

// 创建问诊
router.post('/', async (req, res) => {
  const { caseId, mode = 'FREE' } = req.body;
  
  // 获取病例信息
  const caseData = casesData.get(caseId);
  if (!caseData) {
    res.status(404).json({
      success: false,
      error: { code: 'CASE_NOT_FOUND', message: '病例不存在' },
    });
    return;
  }
  
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
        content: generateOpeningLine(caseData),
        timestamp: new Date().toISOString(),
      },
    ],
    patientPrompt: generatePatientPrompt(caseData),
    createdAt: new Date().toISOString(),
  };
  
  interviews.set(interviewId, interview);
  
  res.json({
    success: true,
    data: interview,
  });
});

function generateOpeningLine(caseData: CaseData): string {
  if (caseData.chiefComplaint.includes('胸痛')) {
    return '医生，我胸口疼得厉害...';
  }
  if (caseData.chiefComplaint.includes('腹痛')) {
    return '医生，我肚子疼...';
  }
  if (caseData.chiefComplaint.includes('咳嗽') || caseData.chiefComplaint.includes('发热')) {
    return '医生，孩子发烧咳嗽...';
  }
  return '医生，我不太舒服...';
}

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
    // 获取病例信息
    const caseData = casesData.get(interview.caseId);
    if (!caseData) {
      throw new Error('病例信息丢失');
    }
    
    // 使用智能回复生成
    const reply = generateContextualReply(
      content,
      caseData,
      interview.messages.map((m: any) => m.content)
    );
    
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