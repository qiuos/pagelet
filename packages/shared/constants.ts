// ============================================
// 应用配置常量
// ============================================

export const APP_NAME = 'Pagelet';
export const APP_VERSION = '1.0.0';

// ============================================
// 文件上传配置
// ============================================

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  html: ['.html', '.htm'],
  zip: ['.zip']
};

// ============================================
// 分享链接配置
// ============================================

export const SLUG_LENGTH = 8; // 随机链接长度
export const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const MAX_SHARE_LINKS_PER_PROJECT = 10; // 每个项目最大分享链接数

// ============================================
// 认证配置
// ============================================

export const JWT_EXPIRES_IN = '24h';
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const BCRYPT_COST_FACTOR = 12;

// ============================================
// 数据库配置
// ============================================

export const DATABASE_PATH = '/app/data/data.db';
export const UPLOADS_DIR = '/app/data/uploads';
export const PROJECTS_DIR = '/app/data/projects';

// 开发环境配置
export const DEV_DATABASE_PATH = './data/data.db';
export const DEV_UPLOADS_DIR = './data/uploads';
export const DEV_PROJECTS_DIR = './data/projects';

// ============================================
// HTTP 响应状态码
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const;

// ============================================
// 错误代码
// ============================================

export const ERROR_CODES = {
  // 认证相关
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // 用户相关
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EXISTS: 'USER_EXISTS',
  INVALID_PASSWORD: 'INVALID_PASSWORD',

  // 项目相关
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_PARSE_ERROR: 'FILE_PARSE_ERROR',

  // 分享相关
  SHARE_NOT_FOUND: 'SHARE_NOT_FOUND',
  SHARE_EXPIRED: 'SHARE_EXPIRED',
  SHARE_INACTIVE: 'SHARE_INACTIVE',
  MAX_VIEWS_EXCEEDED: 'MAX_VIEWS_EXCEEDED',
  INVALID_SHARE_PASSWORD: 'INVALID_SHARE_PASSWORD',

  // 通用
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// ============================================
// 前端路由常量
// ============================================

export const ROUTES = {
  // 公开路由
  LOGIN: '/login',
  SHARE_VIEW: '/s/:slug',
  SHARE_VERIFY: '/s/:slug/verify',

  // 需认证路由
  DASHBOARD: '/',
  PROJECTS: '/projects',
  PROJECT_NEW: '/projects/new',
  PROJECT_DETAIL: '/projects/:id',
  PROJECT_EDIT: '/projects/:id/edit',
  PROJECT_SHARE: '/projects/:id/share',
  SETTINGS: '/settings',
  ADMIN_USERS: '/admin/users'
} as const;

// ============================================
// API 路由常量
// ============================================

export const API_ROUTES = {
  // 认证
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_ME: '/api/auth/me',
  AUTH_CHANGE_PASSWORD: '/api/auth/change-password',

  // 项目
  PROJECTS: '/api/projects',
  PROJECT_DETAIL: '/api/projects/:id',
  PROJECT_PREVIEW: '/api/projects/:id/preview',

  // 分享
  SHARES: '/api/shares',
  SHARE_DETAIL: '/api/shares/:id',

  // 公开访问
  PUBLIC_SHARE: '/s/:slug',
  PUBLIC_VERIFY: '/s/:slug/verify',
  PUBLIC_VIEW: '/s/:slug/view'
} as const;

// ============================================
// 动画配置
// ============================================

export const ANIMATION_VARIANTS = {
  pageInitial: { opacity: 0, y: 20 },
  pageAnimate: { opacity: 1, y: 0 },
  pageExit: { opacity: 0, y: -20 }
} as const;