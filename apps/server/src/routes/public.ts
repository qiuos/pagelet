import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { findShareBySlug, validateShare, incrementViewCount, logView } from '../services/shareService';
import { findProjectById } from '../services/projectService';
import { findUserById } from '../services/userService';
import { ApiResponse, ApiError, ERROR_CODES } from '@pagelet/shared';
import { appConfig } from '../config';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * GET /s/:slug
 * 分享链接预览页
 */
router.get('/:slug', (req: Request, res: Response): void => {
  const { slug } = req.params;
  const share = findShareBySlug(slug);

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

  // 验证分享链接有效性（不检查密码）
  if (!share.isActive) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.SHARE_INACTIVE,
        message: '分享链接已被禁用'
      }
    };
    res.status(400).json(error);
    return;
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.SHARE_EXPIRED,
        message: '分享链接已过期'
      }
    };
    res.status(400).json(error);
    return;
  }

  // 获取关联项目
  const project = findProjectById(share.projectId);
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

  // 获取分享者名称
  const creator = findUserById(share.createdBy);
  const creatorName = creator?.name || '';

  // 返回分享信息
  const response: ApiResponse<{
    share: typeof share;
    project: {
      id: string;
      name: string;
      description?: string;
    };
    creatorName: string;
    needsPassword: boolean;
  }> = {
    success: true,
    data: {
      share,
      project: {
        id: project.id,
        name: project.name,
        description: project.description
      },
      creatorName,
      needsPassword: !!share.passwordHash
    }
  };
  res.json(response);
});

/**
 * POST /s/:slug/verify
 * 验证密码
 */
router.post(
  '/:slug/verify',
  [
    body('password').notEmpty().withMessage('请输入密码')
  ],
  (req: Request, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '请输入密码'
        }
      };
      res.status(400).json(error);
      return;
    }

    const { slug } = req.params;
    const { password } = req.body;

    const share = findShareBySlug(slug);
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

    // 验证分享链接和密码
    const result = validateShare(share, password);
    if (!result.valid) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_SHARE_PASSWORD,
          message: result.error || '验证失败'
        }
      };
      res.status(400).json(error);
      return;
    }

    // 验证成功，设置 cookie 并返回
    res.cookie(`share_token_${slug}`, '1', {
      maxAge: 24 * 60 * 60 * 1000, // 24 小时
      httpOnly: false,
      path: '/'
    });
    const response: ApiResponse<{ valid: boolean }> = {
      success: true,
      data: { valid: true }
    };
    res.json(response);
  }
);

/**
 * GET /s/:slug/view
 * 获取项目入口文件
 */
router.get('/:slug/view', (req: Request, res: Response): void => {
  const { slug } = req.params;
  const share = findShareBySlug(slug);

  if (!share) {
    res.status(404).send('分享链接不存在');
    return;
  }

  // 检查是否有密码保护
  if (share.passwordHash) {
    const token = req.headers['x-share-token'] || (req as any).cookies?.[`share_token_${slug}`];
    if (!token) {
      res.status(401).send('需要验证密码');
      return;
    }
  }

  // 验证分享链接有效性（密码已通过 cookie 验证，跳过密码检查）
  if (!share.isActive) {
    res.status(400).send('分享链接已被禁用');
    return;
  }
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    res.status(400).send('分享链接已过期');
    return;
  }
  if (share.maxViews && share.viewCount >= share.maxViews) {
    res.status(400).send('分享链接已达到最大访问次数');
    return;
  }
  if (share.isOneTime && share.viewCount >= 1) {
    res.status(400).send('一次性链接已失效');
    return;
  }

  // 获取项目
  const project = findProjectById(share.projectId);
  if (!project) {
    res.status(404).send('项目不存在');
    return;
  }

  // 获取入口文件
  try {
    const projectPath = path.join(appConfig.projectsDir, project.id);
    const fullPath = path.resolve(projectPath, project.entryFile);

    if (!fs.existsSync(fullPath)) {
      res.status(404).send('项目文件不存在');
      return;
    }

    // 记录访问日志
    incrementViewCount(share.id);
    logView(share.id, {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer
    });

    res.sendFile(fullPath);
  } catch (err) {
    console.error('[FileServe Error]', err);
    res.status(500).send('服务器错误');
  }
});

/**
 * GET /s/:slug/view/*
 * 获取项目文件（静态资源服务）
 */
router.get('/:slug/view/:file*', (req: Request, res: Response): void => {
  const { slug } = req.params;
  const share = findShareBySlug(slug);

  if (!share) {
    res.status(404).send('分享链接不存在');
    return;
  }

  // 检查是否有密码保护
  if (share.passwordHash) {
    const token = req.headers['x-share-token'] || (req as any).cookies?.[`share_token_${slug}`];
    if (!token) {
      res.status(401).send('需要验证密码');
      return;
    }
  }

  // 验证分享链接有效性（密码已通过 cookie 验证）
  if (!share.isActive) {
    res.status(400).send('分享链接已被禁用');
    return;
  }
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    res.status(400).send('分享链接已过期');
    return;
  }
  if (share.maxViews && share.viewCount >= share.maxViews) {
    res.status(400).send('分享链接已达到最大访问次数');
    return;
  }
  if (share.isOneTime && share.viewCount >= 1) {
    res.status(400).send('一次性链接已失效');
    return;
  }

  // 获取项目
  const project = findProjectById(share.projectId);
  if (!project) {
    res.status(404).send('项目不存在');
    return;
  }

  // 获取请求的文件路径
  const filePath = req.params.file || project.entryFile;

  // 安全检查
  if (filePath.includes('..')) {
    res.status(400).send('非法的文件路径');
    return;
  }

  // 获取文件
  try {
    const projectPath = path.join(appConfig.projectsDir, project.id);
    const fullPath = path.resolve(projectPath, filePath);

    if (!fs.existsSync(fullPath)) {
      res.status(404).send('文件不存在');
      return;
    }

    res.sendFile(fullPath);
  } catch (err) {
    console.error('[FileServe Error]', err);
    res.status(500).send('服务器错误');
  }
});

export default router;