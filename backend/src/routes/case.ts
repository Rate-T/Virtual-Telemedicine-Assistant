import { Router } from 'express';

const router = Router();

// 模拟病例数据
const mockCases = [
  {
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
    icd10Code: 'I21.0',
    department: '心内科',
    difficulty: 4,
    caseType: 'EMERGENCY',
    keywords: '["胸痛", "心肌梗死", "心电图", "ST段抬高"]',
    suitableGrade: '本科三年级',
    teachingPoints: '急性胸痛的鉴别诊断，心肌梗死的诊断标准，心电图改变的意义。',
    commonMistakes: '忽视心电图改变，未及时考虑急性冠脉综合征。',
    expectedDuration: 15,
    status: 'PUBLISHED',
  },
  {
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
    icd10Code: 'K35.8',
    department: '普外科',
    difficulty: 3,
    caseType: 'COMMON',
    keywords: '["腹痛", "阑尾炎", "麦氏点", "转移性右下腹痛"]',
    suitableGrade: '本科二年级',
    teachingPoints: '转移性右下腹痛的特点，阑尾炎的诊断与鉴别诊断。',
    commonMistakes: '与妇科疾病混淆，忽视体格检查。',
    expectedDuration: 12,
    status: 'PUBLISHED',
  },
  {
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
    icd10Code: 'J18.0',
    department: '儿科',
    difficulty: 2,
    caseType: 'COMMON',
    keywords: '["发热", "咳嗽", "肺炎", "儿童"]',
    suitableGrade: '本科一年级',
    teachingPoints: '儿童肺炎的临床表现，肺部听诊特点，胸片解读。',
    commonMistakes: '忽视肺部体征，与上呼吸道感染混淆。',
    expectedDuration: 10,
    status: 'PUBLISHED',
  },
];

// 获取病例列表
router.get('/', (req, res) => {
  const { department, difficulty, search } = req.query;
  
  let cases = mockCases;
  
  if (department) {
    cases = cases.filter(c => c.department === department);
  }
  
  if (difficulty) {
    cases = cases.filter(c => c.difficulty === parseInt(difficulty as string));
  }
  
  if (search) {
    const searchStr = search as string;
    cases = cases.filter(c => 
      c.title.includes(searchStr) || 
      c.chiefComplaint.includes(searchStr)
    );
  }
  
  res.json({
    success: true,
    data: {
      list: cases,
      total: cases.length,
    },
  });
});

// 获取单个病例
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const caseData = mockCases.find(c => c.id === id);
  
  if (!caseData) {
    return res.status(404).json({
      success: false,
      error: { code: 'CASE_NOT_FOUND', message: '病例不存在' },
    });
  }
  
  res.json({
    success: true,
    data: caseData,
  });
});

export default router;