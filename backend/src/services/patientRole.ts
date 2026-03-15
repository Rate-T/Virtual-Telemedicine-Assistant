/**
 * 患者角色生成服务
 * 根据病例信息生成AI患者的系统提示词
 */

export interface CaseData {
  id: string;
  title: string;
  chiefComplaint: string;
  presentIllness: string;
  pastHistory?: string;
  personalHistory?: string;
  familyHistory?: string;
  physicalExam?: string;
  auxiliaryExam?: string;
  diagnosis: string;
}

/**
 * 生成患者角色系统提示词
 */
export function generatePatientPrompt(caseData: CaseData): string {
  return `你是一名患者，正在看医生。请根据以下病情信息，以患者的身份回答医生的提问。

【基本信息】
${caseData.title}

【主诉】
${caseData.chiefComplaint}

【现病史】
${caseData.presentIllness}

【既往史】
${caseData.pastHistory || '无特殊'}

【个人史】
${caseData.personalHistory || '无特殊'}

【家族史】
${caseData.familyHistory || '无特殊'}

【体格检查】
${caseData.physicalExam || '未提及'}

【辅助检查】
${caseData.auxiliaryExam || '未提及'}

【真实诊断】
${caseData.diagnosis}

【角色要求】
1. 你不知道自己得了什么病，不要主动说出诊断
2. 回答要符合病情，但不要过于专业（患者视角）
3. 如果医生问到你不知道的信息，可以回答"不太清楚"或"没注意"
4. 语气要自然，像一个真实的患者
5. 可以适当表现出焦虑、疼痛等情绪
6. 不要一次性说出所有信息，等医生问才回答

请开始扮演这位患者。`;
}

/**
 * 根据问题生成符合病例的回复
 */
export function generateContextualReply(
  question: string,
  caseData: CaseData,
  _conversationHistory: string[]
): string {
  const q = question.toLowerCase();
  
  // 根据问题类型返回相关信息
  if (q.includes('哪里') || q.includes('位置') || q.includes('部位')) {
    return extractLocation(caseData.chiefComplaint);
  }
  
  if (q.includes('多久') || q.includes('时间') || q.includes('什么时候')) {
    return extractDuration(caseData.presentIllness);
  }
  
  if (q.includes('疼') || q.includes('痛') || q.includes('感觉')) {
    return extractPainDescription(caseData.presentIllness);
  }
  
  if (q.includes('以前') || q.includes('病史') || q.includes('得过')) {
    return caseData.pastHistory || '以前身体挺好的，没什么大病。';
  }
  
  if (q.includes('家族') || q.includes('父母') || q.includes('遗传')) {
    return caseData.familyHistory || '家里没人得过这种病。';
  }
  
  if (q.includes('抽烟') || q.includes('喝酒') || q.includes('吸烟')) {
    return caseData.personalHistory || '我不抽烟也不喝酒。';
  }
  
  if (q.includes('检查') || q.includes('化验') || q.includes('拍片')) {
    return caseData.auxiliaryExam || '还没做过什么检查。';
  }
  
  if (q.includes('药') || q.includes('吃') || q.includes('治疗')) {
    return '还没吃过什么药，就是觉得难受才来看医生的。';
  }
  
  // 默认回复
  return '医生，您问的这个我不太清楚，您看还需要了解什么？';
}

function extractLocation(text: string): string {
  const locations = ['胸口', '胸骨后', '心前区', '右上腹', '右下腹', '肚子', '头', '背', '腰'];
  for (const loc of locations) {
    if (text.includes(loc)) return `${loc}这里不舒服`;
  }
  return '就是觉得不舒服，具体位置我也说不太清楚。';
}

function extractDuration(text: string): string {
  const durations = ['2小时', '3天', '1周', '2周', '1个月', '半年', '1年'];
  for (const d of durations) {
    if (text.includes(d)) return `大概有${d}了`;
  }
  return '有一段时间了，具体多久我也记不清。';
}

function extractPainDescription(text: string): string {
  if (text.includes('压榨')) return '像有块大石头压着一样，喘不过气来';
  if (text.includes('刺痛')) return '一阵一阵地刺痛';
  if (text.includes('胀痛')) return '胀胀的疼，很难受';
  if (text.includes('隐痛')) return '隐隐作痛，不是很剧烈但一直不舒服';
  return '就是疼，具体怎么疼我也形容不好。';
}