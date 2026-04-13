import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt';
import { findUserByUsername, findUserById, findUserByIdWithPassword, createUser, verifyPassword, updateUserPassword, ensureAdminUser, countUsers } from '../services/userService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse, ApiError, ERROR_CODES, User } from '@pagelet/shared';

const router = Router();

// 确保管理员账户存在（首次启动时）
ensureAdminUser();

// 辅助函数：提取验证错误详情
function extractValidationErrors(errorsList: any[]): Record<string, string> {
  const details: Record<string, string> = {};
  for (const error of errorsList) {
    if ('path' in error) {
      details[error.path] = error.msg;
    } else if ('param' in error) {
      details[error.param] = error.msg;
    }
  }
  return details;
}

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('请输入用户名'),
    body('password').notEmpty().withMessage('请输入密码')
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '输入验证失败',
          details: extractValidationErrors(errors.array())
        }
      };
      res.status(400).json(error);
      return;
    }

    const { username, password } = req.body;

    // 查找用户
    const userWithPassword = findUserByUsername(username);
    if (!userWithPassword) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: '用户名或密码错误'
        }
      };
      res.status(401).json(error);
      return;
    }

    // 验证密码
    if (!verifyPassword(password, userWithPassword.passwordHash)) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: '用户名或密码错误'
        }
      };
      res.status(401).json(error);
      return;
    }

    // 生成 token
    const token = generateToken({
      userId: userWithPassword.id,
      username: userWithPassword.username,
      role: userWithPassword.role
    });

    // 返回用户信息（不含密码）
    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      name: userWithPassword.name,
      role: userWithPassword.role,
      avatarUrl: userWithPassword.avatarUrl,
      createdAt: userWithPassword.createdAt,
      updatedAt: userWithPassword.updatedAt
    };

    const response: ApiResponse<{ token: string; user: User }> = {
      success: true,
      data: { token, user }
    };

    res.json(response);
  }
);

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', authMiddleware, (_req: Request, res: Response): void => {
  const response: ApiResponse<null> = {
    success: true,
    data: null
  };
  res.json(response);
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const user = findUserById(userId);

  if (!user) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.USER_NOT_FOUND,
        message: '用户不存在'
      }
    };
    res.status(404).json(error);
    return;
  }

  const response: ApiResponse<User> = {
    success: true,
    data: user
  };
  res.json(response);
});

/**
 * POST /api/auth/change-password
 * 修改密码
 */
router.post(
  '/change-password',
  authMiddleware,
  [
    body('currentPassword').notEmpty().withMessage('请输入当前密码'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位')
  ],
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '输入验证失败',
          details: extractValidationErrors(errors.array())
        }
      };
      res.status(400).json(error);
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.userId!;

    // 获取用户（用 userId 而非 username，避免用户改名后找不到）
    const userWithPassword = findUserByIdWithPassword(req.userId!);
    if (!userWithPassword) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.USER_NOT_FOUND,
          message: '用户不存在'
        }
      };
      res.status(404).json(error);
      return;
    }

    // 验证当前密码
    if (!verifyPassword(currentPassword, userWithPassword.passwordHash)) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_PASSWORD,
          message: '当前密码错误'
        }
      };
      res.status(400).json(error);
      return;
    }

    // 更新密码
    updateUserPassword(userId, newPassword);

    const response: ApiResponse<null> = {
      success: true,
      data: null
    };
    res.json(response);
  }
);

/**
 * GET /api/auth/stats
 * 获取系统统计（仅管理员）
 */
router.get('/stats', authMiddleware, (req: AuthRequest, res: Response): void => {
  if (req.userRole !== 'admin') {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: '需要管理员权限'
      }
    };
    res.status(403).json(error);
    return;
  }

  const userCount = countUsers();

  const response: ApiResponse<{ userCount: number }> = {
    success: true,
    data: { userCount }
  };
  res.json(response);
});

export default router;