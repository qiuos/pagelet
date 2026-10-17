import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { findShareBySlug, validateShare, incrementViewCount, logView } from '../services/shareService';
import { findProjectById } from '../services/projectService';
import { findUserById } from '../services/userService';
import { ApiResponse, ApiError, ERROR_CODES } from '@pagelet/shared';
import { getProjectFilePath, projectFileExists } from '../services/storageService';
import { hasShareCookie, setShareCookie } from '../utils/shareToken';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

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
  const project = findProjectById(share.projectId, false);
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
      share: { ...share, password: undefined, passwordHash: undefined },
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
    setShareCookie(req, res, share, 'password');
    const response: ApiResponse<{ valid: boolean }> = {
      success: true,
      data: { valid: true }
    };
    res.json(response);
  }
);

// A signed 30-minute visit admits relative pages/resources after the final allowed view.
// Every request still checks active/expiry/password state; a fresh entry navigation consumes a view.
router.get(['/:slug/view', '/:slug/view/*'], (req: Request, res: Response): void => {
  const { slug } = req.params;
  const share = findShareBySlug(slug);
  if (!share) {
    res.status(404).send('分享链接不存在');
    return;
  }
  if (!share.isActive || (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now())) {
    res.status(400).send(!share.isActive ? '分享链接已被禁用' : '分享链接已过期');
    return;
  }
  if (share.passwordHash && !hasShareCookie(req, share, 'password')) {
    res.status(401).send('需要验证密码');
    return;
  }
  const project = findProjectById(share.projectId, false);
  if (!project) {
    res.status(404).send('项目不存在');
    return;
  }
  const isRedirect = req.params[0] === undefined;
  const file = isRedirect ? project.entryFile : req.params[0];
  try {
    if (!projectFileExists(project.id, file)) {
      res.status(404).send('文件不存在');
      return;
    }
    const hasVisit = hasShareCookie(req, share, 'visit');
    const isEntry = getProjectFilePath(project.id, file) === getProjectFilePath(project.id, project.entryFile);
    const overLimit = (share.maxViews !== undefined && share.viewCount >= share.maxViews) ||
      (share.isOneTime && share.viewCount >= 1);
    if ((isRedirect || isEntry || !hasVisit) && overLimit) {
      res.status(400).send('分享链接已达到最大访问次数');
      return;
    }
    if (isRedirect) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      res.redirect(302, `/api/s/${slug}/view/${project.entryFile.split('/').map(encodeURIComponent).join('/')}${query}`);
      return;
    }
    if (req.method !== 'HEAD' && (isEntry || (!hasVisit && /\.html?$/i.test(file)))) {
      incrementViewCount(share.id);
      logView(share.id, {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      });
      setShareCookie(req, res, share, 'visit');
    }
    res.sendFile(getProjectFilePath(project.id, file), { cacheControl: false, dotfiles: 'allow' });
  } catch {
    res.status(400).send('非法的文件路径');
  }
});

export default router;
