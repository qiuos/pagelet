import { Router, Request, Response } from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { MAX_FILE_SIZE } from '@pagelet/shared';
import {
  createProject,
  findProjectById,
  findProjectsByUserId,
  updateProject,
  deleteProject,
  searchProjects,
  findProjectWithShares
} from '../services/projectService';
import {
  processHtmlFile,
  processZipFile,
  deleteProjectFiles,
  projectFileExists,
  getProjectFilePath
} from '../services/storageService';
import { generateThumbnail } from '../services/thumbnailService';
import { ApiResponse, ApiError, ERROR_CODES, Project } from '@pagelet/shared';

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

// 配置 multer 用于文件上传
const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.html') || ext.endsWith('.htm') || ext.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .html 和 .zip 文件'));
    }
  },
  storage: multer.memoryStorage()
});

// 配置 multer 用于缩略图上传
const thumbnailUpload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  },
  storage: multer.memoryStorage()
});

/**
 * GET /api/projects
 * 获取项目列表
 */
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const query = req.query.q as string | undefined;
  const status = req.query.status as 'active' | 'archived' | undefined;

  const projects = searchProjects(userId, query, status);

  const response: ApiResponse<Project[]> = {
    success: true,
    data: projects
  };
  res.json(response);
});

/**
 * POST /api/projects
 * 创建项目（上传文件）
 */
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.FILE_TOO_LARGE,
          message: '请上传文件'
        }
      };
      res.status(400).json(error);
      return;
    }

    // 验证请求体
    const { name, description } = req.body;
    if (!name || name.trim().length === 0) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '项目名称不能为空'
        }
      };
      res.status(400).json(error);
      return;
    }

    const userId = req.userId!;
    const projectId = createProject(name.trim(), userId).id;

    try {
      // 根据文件类型处理
      const isZip = req.file.originalname.toLowerCase().endsWith('.zip');
      const result = isZip
        ? processZipFile(projectId, req.file)
        : processHtmlFile(projectId, req.file);

      // 更新项目信息
      const project = updateProject(projectId, {
        description: description?.trim(),
        status: 'active'
      })!;

      const response: ApiResponse<Project> = {
        success: true,
        data: project
      };
      res.status(201).json(response);

      // 响应后再异步生成缩略图（不阻塞响应）
      setTimeout(() => {
        try {
          const htmlPath = getProjectFilePath(projectId, result.entryFile);
          generateThumbnail(projectId, htmlPath).then(() => {
            console.log('[Thumbnail] Generated for:', projectId);
          }).catch(err => {
            console.error('[Thumbnail] Failed:', err.message);
          });
        } catch (err: any) {
          console.error('[Thumbnail] Path error:', err.message);
        }
      }, 100);
    } catch (err) {
      // 删除已创建的项目
      deleteProject(projectId);
      throw err;
    }
  }
);

/**
 * GET /api/projects/:id
 * 获取项目详情
 */
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId!;

  const project = findProjectWithShares(id);

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

  // 验证权限
  if (project.createdBy !== userId) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: '无权访问此项目'
      }
    };
    res.status(403).json(error);
    return;
  }

  const response: ApiResponse<typeof project> = {
    success: true,
    data: project
  };
  res.json(response);
});

/**
 * PUT /api/projects/:id
 * 更新项目信息
 */
router.put(
  '/:id',
  authMiddleware,
  [
    body('name').optional().notEmpty().withMessage('项目名称不能为空'),
    body('status').optional().isIn(['active', 'archived']).withMessage('无效的状态')
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
    const userId = req.userId!;

    // 验证项目存在且属于用户
    const existingProject = findProjectById(id);
    if (!existingProject) {
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

    if (existingProject.createdBy !== userId) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: '无权修改此项目'
        }
      };
      res.status(403).json(error);
      return;
    }

    const { name, description, status } = req.body;
    const project = updateProject(id, { name, description, status });

    const response: ApiResponse<Project> = {
      success: true,
      data: project!
    };
    res.json(response);
  }
);

/**
 * DELETE /api/projects/:id
 * 删除项目
 */
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId!;

  // 验证项目存在且属于用户
  const project = findProjectById(id);
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
        message: '无权删除此项目'
      }
    };
    res.status(403).json(error);
    return;
  }

  // 删除文件和数据库记录
  deleteProjectFiles(id);
  deleteProject(id);

  const response: ApiResponse<null> = {
    success: true,
    data: null
  };
  res.json(response);
});

/**
 * GET /api/projects/:id/preview
 * 预览项目（返回预览 URL）
 */
router.get('/:id/preview', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId!;

  const project = findProjectById(id);

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
        message: '无权访问此项目'
      }
    };
    res.status(403).json(error);
    return;
  }

  // 检查文件是否存在
  if (!projectFileExists(id, project.entryFile)) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FILE_PARSE_ERROR,
        message: '项目文件不存在'
      }
    };
    res.status(404).json(error);
    return;
  }

  const response: ApiResponse<{ previewUrl: string }> = {
    success: true,
    data: {
      previewUrl: `/api/projects/${id}/view/${project.entryFile}`
    }
  };
  res.json(response);
});

/**
 * POST /api/projects/:id/thumbnail/regenerate
 * 重新生成缩略图（从 HTML）
 */
router.post('/:id/thumbnail/regenerate', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId!;

  const project = findProjectById(id);
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
        message: '无权修改此项目'
      }
    };
    res.status(403).json(error);
    return;
  }

  try {
    const htmlPath = getProjectFilePath(id, project.entryFile);
    const thumbnail = await generateThumbnail(id, htmlPath);

    if (!thumbnail) {
      const error: ApiError = {
        success: false,
        error: {
          code: ERROR_CODES.FILE_PARSE_ERROR,
          message: '生成缩略图失败'
        }
      };
      res.status(500).json(error);
      return;
    }

    const response: ApiResponse<{ thumbnail: string }> = {
      success: true,
      data: { thumbnail }
    };
    res.json(response);
  } catch (err) {
    console.error('[Thumbnail] Regenerate error:', err);
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FILE_PARSE_ERROR,
        message: '生成缩略图失败'
      }
    };
    res.status(500).json(error);
  }
});

/**
 * POST /api/projects/:id/thumbnail/upload
 * 上传自定义缩略图
 */
router.post('/:id/thumbnail/upload', authMiddleware, thumbnailUpload.single('thumbnail'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) {
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: '请上传图片文件'
      }
    };
    res.status(400).json(error);
    return;
  }

  const { id } = req.params;
  const userId = req.userId!;

  const project = findProjectById(id);
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
        message: '无权修改此项目'
      }
    };
    res.status(403).json(error);
    return;
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const { appConfig } = await import('../config');

    // 确定图片格式
    const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf('.'));
    const thumbnailPath = path.join(appConfig.projectsDir, id, '.thumbnail' + ext);

    // 确保目录存在
    const thumbnailDir = path.join(appConfig.projectsDir, id);
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // 删除旧的缩略图文件
    const oldThumbnails = fs.readdirSync(thumbnailDir).filter(f => f.startsWith('.thumbnail'));
    for (const old of oldThumbnails) {
      fs.unlinkSync(path.join(thumbnailDir, old));
    }

    // 保存新缩略图
    fs.writeFileSync(thumbnailPath, req.file.buffer);

    const thumbnail = `data:image/${ext.slice(1)};base64,${req.file.buffer.toString('base64')}`;

    const response: ApiResponse<{ thumbnail: string }> = {
      success: true,
      data: { thumbnail }
    };
    res.json(response);
  } catch (err) {
    console.error('[Thumbnail] Upload error:', err);
    const error: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.FILE_PARSE_ERROR,
        message: '上传缩略图失败'
      }
    };
    res.status(500).json(error);
  }
});

export default router;