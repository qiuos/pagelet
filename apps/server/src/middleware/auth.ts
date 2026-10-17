import { Request, Response, NextFunction } from 'express';
import { verifyToken, decodeToken } from '../utils/jwt';
import { ApiError, ERROR_CODES, HTTP_STATUS } from '@pagelet/shared';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  userRole?: string;
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  const payload = decodeToken(token) as ({ exp?: number } | null);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    path: '/api',
    ...(payload?.exp ? { expires: new Date(payload.exp * 1000) } : {})
  });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) :
    (['GET', 'HEAD'].includes(req.method) ? req.cookies?.token : undefined);

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
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) :
    (['GET', 'HEAD'].includes(req.method) ? req.cookies?.token : undefined);

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