import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { ApiError, ERROR_CODES, HTTP_STATUS } from '@pagelet/shared';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  userRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: '未提供认证令牌'
      }
    };
    res.status(HTTP_STATUS.UNAUTHORIZED).json(error);
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.TOKEN_INVALID,
        message: '无效或过期的令牌'
      }
    };
    res.status(HTTP_STATUS.UNAUTHORIZED).json(error);
    return;
  }

  req.userId = payload.userId;
  req.username = payload.username;
  req.userRole = payload.role;
  next();
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.userId = payload.userId;
      req.username = payload.username;
      req.userRole = payload.role;
    }
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: '需要管理员权限'
      }
    };
    res.status(HTTP_STATUS.FORBIDDEN).json(error);
    return;
  }
  next();
}