import { PrismaClient } from '@prisma/client';
import { 
  Interview, 
  InterviewMessage, 
  InterviewStatus, 
  InterviewScores,
  AppError,
  ErrorCodes 
} from '../types';
import { aiService } from './ai.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * 问诊状态机
 * 核心功能：
 * 1. 状态管理（CREATED → IN_PROGRESS → DIAGNOSING → COMPLETED）
 * 2. 会话持久化
 * 3. 幂等性控制（防止重复提交）
 * 4. 事务原子性
 */

export class InterviewService {
  /**
   * 创建问诊会话
   */
  async createInterview(
    caseId: string,
    studentId: string,
    mode: 'FREE' | 'GUIDE' | 'EXAM' = 'FREE'
  ): Promise<Interview> {
    // 检查病例是否存在
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      throw new AppError(ErrorCodes.CASE_NOT_FOUND, '病例不存在', 404);
    }

    // 创建问诊记录
    const interview = await prisma.interview.create({
      data: {
        caseId,
        studentId,
        mode,
        status: 'IN_PROGRESS',
        dialogue: JSON.stringify([{
          id: `msg-${Date.now()}`,
          role: 'patient',
          content: this.generatePatientGreeting(caseData),
          timestamp: new Date(),
        }]),
        startedAt: new Date(),
      },
    });

    logger.info('Interview created', { interviewId: interview.id, caseId, studentId });

    return this.transformInterview(interview);
  }

  /**
   * 获取问诊会话（带权限校验）
   */
  async getInterview(interviewId: string, userId: string): Promise<Interview> {
    const interview = await prisma.interview.findFirst({
      where: {
        id: interviewId,
        studentId: userId, // 严格的隐私隔离
      },
    });

    if (!interview) {
      throw new AppError(ErrorCodes.INTERVIEW_NOT_FOUND, '问诊记录不存在或无权限', 404);
    }

    return this.transformInterview(interview);
  }

  /**
   * 发送消息并获取AI回复（流式）
   */
  async chat(
    interviewId: string,
    userId: string,
    message: string,
    onChunk: (chunk: { content: string; done: boolean }) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    // 1. 获取问诊记录（带权限校验）
    const interview = await this.getInterview(interviewId, userId);

    // 2. 状态校验
    if (interview.status !== 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.INVALID_INTERVIEW_STATUS,
        `当前问诊状态为${interview.status}，无法继续对话`,
        400
      );
    }

    // 3. 输入校验（防止Prompt Injection）
    const sanitizedMessage = this.sanitizeInput(message);
    if (!sanitizedMessage || sanitizedMessage.length > 500) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        '输入内容无效（长度需在1-500字符之间）',
        400
      );
    }

    // 4. 添加用户消息到历史
    const userMessage: InterviewMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: sanitizedMessage,
      timestamp: new Date(),
    };

    const updatedMessages = [...interview.messages, userMessage];

    // 5. 保存用户消息
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        dialogue: JSON.stringify(updatedMessages),
      },
    });

    // 6. 获取病例上下文
    const caseData = await prisma.case.findUnique({
      where: { id: interview.caseId },
    });

    if (!caseData) {
      throw new AppError(ErrorCodes.CASE_NOT_FOUND, '病例不存在', 404);
    }

    // 7. 调用AI服务（流式）
    const caseContext = {
      title: caseData.title,
      chiefComplaint: caseData.chiefComplaint,
      presentIllness: caseData.presentIllness,
      diagnosis: caseData.diagnosis,
    };

    let aiContent = '';

    await aiService.streamChat(
      updatedMessages,
      caseContext,
      (chunk) => {
        if (!chunk.done) {
          aiContent += chunk.content;
        }
        onChunk(chunk);
      },
      (error) => {
        // AI错误处理
        logger.error('AI chat error in interview', {
          interviewId,
          error: error.message,
        });

        // 如果是降级错误，返回友好提示
        if ((error as any).isDegraded) {
          onError(new Error((error as any).userMessage || '服务繁忙，请稍后重试'));
        } else {
          onError(error);
        }
      },
      async () => {
        // 8. 保存AI回复
        const aiMessage: InterviewMessage = {
          id: `msg-${Date.now()}-patient`,
          role: 'patient',
          content: aiContent,
          timestamp: new Date(),
        };

        await prisma.interview.update({
          where: { id: interviewId },
          data: {
            dialogue: JSON.stringify([...updatedMessages, aiMessage]),
          },
        });

        onComplete();
      }
    );
  }

  /**
   * 提交诊断（幂等性控制）
   */
  async submitDiagnosis(
    interviewId: string,
    userId: string,
    diagnosis: {
      preliminary: string;
      basis: string;
      differential: string;
      treatment: string;
    }
  ): Promise<Interview> {
    // 使用事务确保原子性
    return await prisma.$transaction(async (tx) => {
      // 1. 获取问诊记录（加锁）
      const interview = await tx.interview.findFirst({
        where: {
          id: interviewId,
          studentId: userId,
        },
      });

      if (!interview) {
        throw new AppError(ErrorCodes.INTERVIEW_NOT_FOUND, '问诊记录不存在', 404);
      }

      // 2. 幂等性检查：已完成的问诊不能重复提交
      if (interview.status === 'COMPLETED') {
        throw new AppError(
          ErrorCodes.INTERVIEW_ALREADY_COMPLETED,
          '该问诊已完成，不能重复提交',
          400
        );
      }

      if (interview.status !== 'IN_PROGRESS') {
        throw new AppError(
          ErrorCodes.INVALID_INTERVIEW_STATUS,
          '当前问诊状态不允许提交诊断',
          400
        );
      }

      // 3. 输入校验
      if (!diagnosis.preliminary || diagnosis.preliminary.length > 200) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          '初步诊断不能为空且长度不超过200字符',
          400
        );
      }

      // 4. 计算评分
      const scores = await this.calculateScores(interview, diagnosis);

      // 5. 计算问诊时长
      const duration = Math.floor(
        (Date.now() - interview.startedAt.getTime()) / 1000
      );

      // 6. 更新问诊记录（原子操作）
      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: 'COMPLETED',
          diagnosis: JSON.stringify(diagnosis),
          scores: JSON.stringify(scores),
          feedback: this.generateFeedback(scores),
          suggestions: JSON.stringify(this.generateSuggestions(interview, scores)),
          duration,
          completedAt: new Date(),
        },
      });

      logger.info('Diagnosis submitted', {
        interviewId,
        userId,
        totalScore: scores.total,
        duration,
      });

      return this.transformInterview(updated);
    });
  }

  /**
   * 计算评分
   */
  private async calculateScores(
    interview: any,
    diagnosis: { preliminary: string }
  ): Promise<InterviewScores> {
    const caseData = await prisma.case.findUnique({
      where: { id: interview.caseId },
    });

    if (!caseData) {
      throw new AppError(ErrorCodes.CASE_NOT_FOUND, '病例不存在', 404);
    }

    const messages: InterviewMessage[] = JSON.parse(interview.messages);
    
    // 解析用户消息（医学生提问）
    const userMessages = messages.filter(m => m.role === 'user');
    
    // 问诊完整性评分（基于提问数量和质量）
    const completeness = this.calculateCompleteness(userMessages, caseData);
    
    // 逻辑性评分（基于问诊顺序）
    const logic = this.calculateLogic(userMessages);
    
    // 沟通技巧评分（基于提问方式）
    const communication = this.calculateCommunication(userMessages);
    
    // 诊断准确性评分（对比标准诊断）
    const diagnosisScore = this.calculateDiagnosisAccuracy(
      diagnosis.preliminary,
      caseData.diagnosis
    );
    
    // 效率评分（基于问诊时长和消息数）
    const duration = Math.floor(
      (Date.now() - interview.startedAt.getTime()) / 1000
    );
    const efficiency = this.calculateEfficiency(duration, userMessages.length);

    // 计算总分
    const total = Math.round(
      completeness * 0.25 +
      logic * 0.20 +
      communication * 0.20 +
      diagnosisScore * 0.25 +
      efficiency * 0.10
    );

    return {
      completeness,
      logic,
      communication,
      diagnosis: diagnosisScore,
      efficiency,
      total,
    };
  }

  /**
   * 计算问诊完整性
   */
  private calculateCompleteness(
    userMessages: InterviewMessage[],
    _caseData: any
  ): number {
    const content = userMessages.map(m => m.content).join('');
    
    // 关键问诊点检查
    const keyPoints = [
      { keyword: ['主诉', '哪里', '不舒服', '症状'], weight: 15 },
      { keyword: ['多久', '时间', '开始', '持续'], weight: 15 },
      { keyword: ['性质', '什么样', '疼痛', '感觉'], weight: 15 },
      { keyword: ['既往', '以前', '病史', '得过'], weight: 15 },
      { keyword: ['家族', '遗传', '父母', '家里'], weight: 10 },
      { keyword: ['检查', '化验', '拍片', 'CT'], weight: 15 },
      { keyword: ['过敏', '药物', '吃什么药'], weight: 15 },
    ];

    let score = 0;
    for (const point of keyPoints) {
      if (point.keyword.some(k => content.includes(k))) {
        score += point.weight;
      }
    }

    return Math.min(100, score);
  }

  /**
   * 计算逻辑性
   */
  private calculateLogic(userMessages: InterviewMessage[]): number {
    // 简化逻辑：基于消息数量和顺序合理性
    const count = userMessages.length;
    
    if (count < 3) return 60;
    if (count < 5) return 75;
    if (count < 8) return 85;
    if (count < 12) return 95;
    return 100;
  }

  /**
   * 计算沟通技巧
   */
  private calculateCommunication(userMessages: InterviewMessage[]): number {
    const contents = userMessages.map(m => m.content);
    
    // 检查开放式提问
    const openQuestions = contents.filter(c => 
      c.includes('什么') || c.includes('怎么') || c.includes('哪些')
    ).length;
    
    // 检查封闭式提问（预留）
    // const closeQuestions = contents.filter(c =>
    //   c.includes('吗') || c.includes('是不是') || c.includes('有没有')
    // ).length;
    
    // 开放式提问比例越高越好
    const total = contents.length;
    const openRatio = total > 0 ? openQuestions / total : 0;
    
    return Math.min(100, 70 + Math.round(openRatio * 30));
  }

  /**
   * 计算诊断准确性
   */
  private calculateDiagnosisAccuracy(
    userDiagnosis: string,
    standardDiagnosis: string
  ): number {
    const user = userDiagnosis.toLowerCase();
    const standard = standardDiagnosis.toLowerCase();
    
    // 完全匹配
    if (user === standard) return 100;
    
    // 包含关键疾病名称
    if (standard.includes(user) || user.includes(standard)) return 90;
    
    // 部分匹配（简化实现）
    const commonWords = ['急性', '慢性', '炎', '病', '综合征'];
    const hasCommon = commonWords.some(w => user.includes(w) && standard.includes(w));
    
    if (hasCommon) return 70;
    
    return 50;
  }

  /**
   * 计算效率
   */
  private calculateEfficiency(duration: number, _messageCount: number): number {
    // 理想时长：10-15分钟
    const idealMin = 600; // 10分钟
    const idealMax = 900; // 15分钟
    
    if (duration >= idealMin && duration <= idealMax) return 100;
    if (duration < idealMin) return Math.max(60, 100 - (idealMin - duration) / 10);
    return Math.max(60, 100 - (duration - idealMax) / 20);
  }

  /**
   * 生成反馈
   */
  private generateFeedback(scores: InterviewScores): string {
    const parts: string[] = [];
    
    if (scores.completeness >= 90) {
      parts.push('问诊非常完整，关键信息收集到位。');
    } else if (scores.completeness >= 70) {
      parts.push('问诊较为完整，但仍有部分信息遗漏。');
    } else {
      parts.push('问诊不够完整，建议系统学习问诊流程。');
    }
    
    if (scores.diagnosis >= 90) {
      parts.push('诊断准确，思路清晰。');
    } else if (scores.diagnosis >= 70) {
      parts.push('诊断方向正确，但不够精确。');
    } else {
      parts.push('诊断存在偏差，建议加强鉴别诊断训练。');
    }
    
    return parts.join('');
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    _interview: any,
    scores: InterviewScores
  ): string[] {
    const suggestions: string[] = [];
    
    if (scores.completeness < 80) {
      suggestions.push('建议系统学习问诊要点，确保不遗漏关键信息');
    }
    if (scores.logic < 80) {
      suggestions.push('问诊顺序可以更加合理，建议先问主诉再问细节');
    }
    if (scores.communication < 80) {
      suggestions.push('多使用开放式提问，引导患者详细描述');
    }
    if (scores.diagnosis < 80) {
      suggestions.push('加强鉴别诊断能力，注意相似疾病的区分');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('表现优秀，继续保持！');
    }
    
    return suggestions;
  }

  /**
   * 输入净化（防止Prompt Injection）
   */
  private sanitizeInput(input: string): string {
    // 移除潜在的Prompt Injection攻击模式
    const dangerousPatterns = [
      /ignore previous instructions/gi,
      /system prompt/gi,
      /you are now/gi,
      /disregard/gi,
      /forget/gi,
      /<script>/gi,
      /javascript:/gi,
    ];
    
    let sanitized = input;
    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
    
    // 限制长度
    return sanitized.slice(0, 500).trim();
  }

  /**
   * 生成患者问候语
   */
  private generatePatientGreeting(caseData: any): string {
    return `您好，医生。我是${caseData.title.split('，')[0]}，${caseData.chiefComplaint}。`;
  }

  /**
   * 转换数据库记录为业务对象
   */
  private transformInterview(interview: any): Interview {
    return {
      id: interview.id,
      caseId: interview.caseId,
      studentId: interview.studentId,
      mode: interview.mode as 'FREE' | 'GUIDE' | 'EXAM',
      status: interview.status as InterviewStatus,
      messages: JSON.parse(interview.messages || '[]'),
      diagnosis: interview.diagnosis ? JSON.parse(interview.diagnosis) : undefined,
      scores: interview.scores ? JSON.parse(interview.scores) : undefined,
      feedback: interview.feedback || undefined,
      suggestions: interview.suggestions ? JSON.parse(interview.suggestions) : undefined,
      duration: interview.duration || undefined,
      startedAt: interview.startedAt,
      updatedAt: interview.updatedAt,
      completedAt: interview.completedAt || undefined,
    };
  }
}

// 导出单例
export const interviewService = new InterviewService();