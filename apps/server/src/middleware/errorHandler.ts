import { Request, Response, NextFunction } from 'express';
import { ApiError, ERROR_CODES } from '@pagelet/shared';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  // Zod 验证错误
  if (err instanceof ZodError) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: '输入数据格式不正确',
        details: err.errors.reduce((acc, e) => {
          acc[e.path.join('.')] = e.message;
          return acc;
        }, {} as Record<string, string>)
      }
    };
    res.status(400).json(error);
    return;
  }

  // API 错误
  if ('code' in err && 'message' in err) {
    const apiError = err as { code: string; message: string; details?: Record<string, string> };
    const error: ApiError = {
      success: false,
      error: apiError
    };

    // 根据错误代码确定状态码
    let statusCode = 500;
    if (apiError.code.startsWith('AUTH') || apiError.code === ERROR_CODES.UNAUTHORIZED || apiError.code === ERROR_CODES.TOKEN_EXPIRED || apiError.code === ERROR_CODES.TOKEN_INVALID) {
      statusCode = 401;
    } else if (apiError.code === ERROR_CODES.INVALID_PASSWORD || apiError.code === ERROR_CODES.INVALID_CREDENTIALS) {
      statusCode = 401;
    } else if (
      apiError.code === ERROR_CODES.USER_NOT_FOUND ||
      apiError.code === ERROR_CODES.PROJECT_NOT_FOUND ||
      apiError.code === ERROR_CODES.SHARE_NOT_FOUND
    ) {
      statusCode = 404;
    } else if (
      apiError.code === ERROR_CODES.USER_EXISTS ||
      apiError.code === ERROR_CODES.FILE_PARSE_ERROR
    ) {
      statusCode = 409;
    } else if (apiError.code.startsWith('VALIDATION') || apiError.code.startsWith('INVALID')) {
      statusCode = 400;
    }

    res.status(statusCode).json(error);
    return;
  }

  // 未知错误
  const error: ApiError = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
    }
  };
  res.status(500).json(error);
}

// 创建自定义 API 错误
export class AppError extends Error {
  code: string;
  details?: Record<string, string>;

  constructor(code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function createError(code: string, message: string, details?: Record<string, string>): AppError {
  return new AppError(code, message, details);
}