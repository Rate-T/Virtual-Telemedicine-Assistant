// 通用类型定义

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 用户类型
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  avatar?: string;
  createdAt: Date;
}

// 病例类型
export interface Case {
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
  icd10Code?: string;
  department: string;
  difficulty: number;
  caseType: 'COMMON' | 'RARE' | 'EMERGENCY' | 'CHRONIC';
  keywords?: string[];
  suitableGrade?: string;
  teachingPoints?: string;
  commonMistakes?: string;
  expectedDuration?: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 问诊消息类型
export interface InterviewMessage {
  id: string;
  role: 'user' | 'patient' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    examType?: 'physical' | 'auxiliary';
    examItem?: string;
    examResult?: string;
  };
}

// 问诊状态
export type InterviewStatus = 
  | 'CREATED'      // 刚创建
  | 'IN_PROGRESS'  // 进行中
  | 'DIAGNOSING'   // 填写诊断中
  | 'COMPLETED'    // 已完成
  | 'ABANDONED';   // 已放弃

// 问诊会话
export interface Interview {
  id: string;
  caseId: string;
  studentId: string;
  mode: 'FREE' | 'GUIDE' | 'EXAM';
  status: InterviewStatus;
  messages: InterviewMessage[];
  diagnosis?: {
    preliminary: string;
    basis: string;
    differential: string;
    treatment: string;
  };
  scores?: InterviewScores;
  feedback?: string;
  suggestions?: string[];
  duration?: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 问诊评分
export interface InterviewScores {
  completeness: number;  // 问诊完整性
  logic: number;         // 逻辑性
  communication: number; // 沟通技巧
  diagnosis: number;     // 诊断准确性
  efficiency: number;    // 时间效率
  total: number;         // 总分
}

// AI对话请求
export interface AIChatRequest {
  interviewId: string;
  caseId: string;
  messages: InterviewMessage[];
  userMessage: string;
}

// AI对话响应（流式）
export interface AIChatStreamResponse {
  content: string;
  done: boolean;
  metadata?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    responseTime?: number;
  };
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// 错误类型
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// 常见错误码
export const ErrorCodes = {
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // 业务错误
  CASE_NOT_FOUND: 'CASE_NOT_FOUND',
  INTERVIEW_NOT_FOUND: 'INTERVIEW_NOT_FOUND',
  INTERVIEW_ALREADY_COMPLETED: 'INTERVIEW_ALREADY_COMPLETED',
  INVALID_INTERVIEW_STATUS: 'INVALID_INTERVIEW_STATUS',
  
  // AI服务错误
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  
  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;