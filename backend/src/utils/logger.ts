import winston from 'winston';
import config from './config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// 自定义日志格式
const customFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// 创建日志实例
export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: { service: 'medcase-ai-backend' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      ),
    }),
    
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      ),
    }),
    
    // 所有日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      ),
    }),
  ],
  
  // 未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  
  // 未处理的Promise拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// AI调用专用日志
export const aiLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'medcase-ai-backend', module: 'ai' },
  transports: [
    new winston.transports.File({
      filename: 'logs/ai-calls.log',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

export default logger;