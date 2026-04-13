import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { MAX_SHARE_LINKS_PER_PROJECT } from '@pagelet/shared';
import {
  createShare,
  findShareById,
  findSharesByProjectId,
  findSharesByUserId,
  updateShare,
  deleteShare
} from '../services/shareService';
import { findProjectById } from '../services/projectService';
import { ApiResponse, ApiError, ERROR_CODES, Share } from '@pagelet/shared';

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
 * GET /api/shares
 * 获取用户的所有分享链接
 */
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const shares = findSharesByUserId(userId);

  const response: ApiResponse<Share[]> = {
    success: true,
    data: shares
  };
  res.json(response);
});

/**
 * GET /api/shares/project/:projectId
 * 获取项目的所有分享链接
 */
router.get('/project/:projectId', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { projectId } = req.params;
  const userId = req.userId!;

  // 验证项目存在且属于用户
  const project = findProjectById(projectId);
  if (!project) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.PROJECT_NOT_FOUND,
        message: '项目不存在'
      }
    };
    res.status(404).json(error);
    return;
  }

  if (project.createdBy !== userId) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: '无权访问此项目的分享链接'
      }
    };
    res.status(403).json(error);
    return;
  }

  const shares = findSharesByProjectId(projectId);

  const response: ApiResponse<Share[]> = {
    success: true,
    data: shares
  };
  res.json(response);
});

/**
 * POST /api/shares
 * 创建分享链接
 */
router.post(
  '/',
  authMiddleware,
  [
    body('projectId').notEmpty().withMessage('项目 ID 不能为空'),
    body('password').optional().isLength({ min: 4 }).withMessage('密码至少4位'),
    body('maxViews').optional().isInt({ min: 1 }).withMessage('最大访问次数必须大于0'),
    body('isOneTime').optional().isBoolean().withMessage('isOneTime 必须是布尔值')
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

    const { projectId, password, expiresAt, maxViews, isOneTime } = req.body;
    const userId = req.userId!;

    // 验证项目存在且属于用户
    const project = findProjectById(projectId);
    if (!project) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.PROJECT_NOT_FOUND,
          message: '项目不存在'
        }
      };
      res.status(404).json(error);
      return;
    }

    if (project.createdBy !== userId) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: '无权为此项目创建分享链接'
        }
      };
      res.status(403).json(error);
      return;
    }

    // 检查分享链接数量限制
    const existingShares = findSharesByProjectId(projectId);
    if (existingShares.length >= MAX_SHARE_LINKS_PER_PROJECT) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `每个项目最多创建 ${MAX_SHARE_LINKS_PER_PROJECT} 个分享链接`
        }
      };
      res.status(400).json(error);
      return;
    }

    // 创建分享链接
    const share = createShare(projectId, userId, {
      password,
      expiresAt,
      maxViews,
      isOneTime
    });

    const response: ApiResponse<Share> = {
      success: true,
      data: share
    };
    res.status(201).json(response);
  }
);

/**
 * PUT /api/shares/:id
 * 更新分享链接设置
 */
router.put(
  '/:id',
  authMiddleware,
  (req: AuthRequest, res: Response): void => {
    const { id } = req.params;
    const userId = req.userId!;
    const { password, expiresAt, maxViews, isOneTime, isActive } = req.body;

    // 验证分享链接存在
    const share = findShareById(id);
    if (!share) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.SHARE_NOT_FOUND,
          message: '分享链接不存在'
        }
      };
      res.status(404).json(error);
      return;
    }

    // 验证权限
    if (share.createdBy !== userId) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: '无权修改此分享链接'
        }
      };
      res.status(403).json(error);
      return;
    }

    // 更新分享链接
    const updatedShare = updateShare(id, {
      password,
      expiresAt,
      maxViews,
      isOneTime,
      isActive
    });

    const response: ApiResponse<Share> = {
      success: true,
      data: updatedShare!
    };
    res.json(response);
  }
);

/**
 * DELETE /api/shares/:id
 * 删除分享链接
 */
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId!;

  // 验证分享链接存在
  const share = findShareById(id);
  if (!share) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.SHARE_NOT_FOUND,
        message: '分享链接不存在'
      }
    };
    res.status(404).json(error);
    return;
  }

  // 验证权限
  if (share.createdBy !== userId) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: '无权删除此分享链接'
      }
    };
    res.status(403).json(error);
    return;
  }

  deleteShare(id);

  const response: ApiResponse<null> = {
    success: true,
    data: null
  };
  res.json(response);
});

export default router;