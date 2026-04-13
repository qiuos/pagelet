import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, AuthRequest, requireAdmin } from '../middleware/auth';
import { ApiResponse, ApiError, ERROR_CODES, User, UserRole } from '@pagelet/shared';
import {
  findAllUsers,
  findUserById,
  findUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  countUsers
} from '../services/userService';

const router = Router();

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
 * GET /api/users
 * 获取用户列表（仅管理员）
 */
router.get('/', authMiddleware, requireAdmin, (_req: AuthRequest, res: Response): void => {
  const users = findAllUsers();

  const response: ApiResponse<User[]> = {
    success: true,
    data: users
  };
  res.json(response);
});

/**
 * GET /api/users/stats
 * 获取用户统计（仅管理员）
 */
router.get('/stats', authMiddleware, requireAdmin, (_req: AuthRequest, res: Response): void => {
  const totalUsers = countUsers();

  const response: ApiResponse<{ totalUsers: number }> = {
    success: true,
    data: { totalUsers }
  };
  res.json(response);
});

/**
 * GET /api/users/:id
 * 获取用户详情（仅管理员）
 */
router.get('/:id', authMiddleware, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const user = findUserById(id);

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
 * POST /api/users
 * 创建用户（仅管理员）
 */
router.post(
  '/',
  authMiddleware,
  requireAdmin,
  [
    body('username').notEmpty().withMessage('请输入用户名').isLength({ min: 2 }).withMessage('用户名至少2个字符'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('name').notEmpty().withMessage('请输入显示名称'),
    body('role').optional().isIn(['admin', 'member']).withMessage('无效的角色')
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

    const { username, password, name, role } = req.body;

    // 检查用户名是否已存在
    if (findUserByUsername(username)) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '该用户名已被使用'
        }
      };
      res.status(400).json(error);
      return;
    }

    const user = createUser(username, password, name, role as UserRole || 'member');

    const response: ApiResponse<User> = {
      success: true,
      data: user
    };
    res.status(201).json(response);
  }
);

/**
 * PUT /api/users/:id
 * 更新用户信息（仅管理员）
 */
router.put(
  '/:id',
  authMiddleware,
  requireAdmin,
  [
    body('username').optional().notEmpty().withMessage('用户名不能为空'),
    body('name').optional().notEmpty().withMessage('显示名称不能为空'),
    body('role').optional().isIn(['admin', 'member']).withMessage('无效的角色')
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

    const { id } = req.params;
    const { username, name, role } = req.body;

    // 检查用户是否存在
    const existingUser = findUserById(id);
    if (!existingUser) {
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

    // 检查用户名是否与其他用户冲突
    if (username && username !== existingUser.username) {
      const conflict = findUserByUsername(username);
      if (conflict) {
        const error: ApiError = {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: '该用户名已被使用'
          }
        };
        res.status(400).json(error);
        return;
      }
    }

    const user = updateUser(id, { username, name, role });

    const response: ApiResponse<User> = {
      success: true,
      data: user!
    };
    res.json(response);
  }
);

/**
 * POST /api/users/:id/reset-password
 * 重置用户密码（仅管理员）
 */
router.post(
  '/:id/reset-password',
  authMiddleware,
  requireAdmin,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('密码至少6位')
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

    const { id } = req.params;
    const { newPassword } = req.body;

    // 检查用户是否存在
    const existingUser = findUserById(id);
    if (!existingUser) {
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

    resetUserPassword(id, newPassword);

    const response: ApiResponse<null> = {
      success: true,
      data: null
    };
    res.json(response);
  }
);

/**
 * DELETE /api/users/:id
 * 删除用户（仅管理员）
 */
router.delete('/:id', authMiddleware, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  // 不能删除自己
  if (id === req.userId) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: '不能删除自己的账户'
      }
    };
    res.status(403).json(error);
    return;
  }

  // 检查用户是否存在
  const existingUser = findUserById(id);
  if (!existingUser) {
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

  deleteUser(id);

  const response: ApiResponse<null> = {
    success: true,
    data: null
  };
  res.json(response);
});

export default router;