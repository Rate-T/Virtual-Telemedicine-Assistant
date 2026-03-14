import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from './config';
import { JWTPayload, AppError, ErrorCodes } from './types';

// 扩展Express Request类型
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT认证中间件
 * 所有问诊相关API必须通过此中间件
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // 1. 获取Authorization头
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED,
        '未提供认证令牌',
        401
      );
    }

    // 2. 解析Bearer令牌
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED,
        '认证格式错误，应为Bearer {token}',
        401
      );
    }

    const token = parts[1];

    // 3. 验证JWT
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // 4. 检查令牌是否过期
    if (decoded.exp < Date.now() / 1000) {
      throw new AppError(
        ErrorCodes.TOKEN_EXPIRED,
        '认证令牌已过期',
        401
      );
    }

    // 5. 将用户信息附加到请求
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(
        ErrorCodes.UNAUTHORIZED,
        '无效的认证令牌',
        401
      ));
      return;
    }

    next(new AppError(
      ErrorCodes.UNAUTHORIZED,
      '认证失败',
      401
    ));
  }
};

/**
 * 角色权限检查中间件
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(
        ErrorCodes.UNAUTHORIZED,
        '未认证',
        401
      ));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(
        ErrorCodes.FORBIDDEN,
        '权限不足',
        403
      ));
      return;
    }

    next();
  };
};

/**
 * 可选认证（用于公开接口）
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      next();
      return;
    }

    const token = parts[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    if (decoded.exp >= Date.now() / 1000) {
      req.user = decoded;
    }

    next();
  } catch {
    // 可选认证失败不阻止请求
    next();
  }
};