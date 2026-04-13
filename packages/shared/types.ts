// ============================================
// 用户相关类型
// ============================================

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithoutSensitive extends Omit<User, never> {
  // 已公开的用户信息，不含密码
}

// ============================================
// 项目相关类型
// ============================================

export type ProjectStatus = 'active' | 'archived';
export type FileType = 'html' | 'zip';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  fileType: FileType;
  fileSize: number;
  entryFile: string;
  thumbnail?: string;  // 缩略图 base64
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithShares extends Project {
  shares: Share[];
  shareCount: number;
}

// ============================================
// 分享链接相关类型
// ============================================

export interface Share {
  id: string;
  projectId: string;
  slug: string;
  passwordHash?: string;
  password?: string;
  expiresAt?: string;
  viewCount: number;
  maxViews?: number;
  isOneTime: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  hasPassword: boolean;
}

export interface ShareWithProject extends Share {
  project: Project;
}

// ============================================
// 访问日志相关类型
// ============================================

export interface ViewLog {
  id: string;
  shareId: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  viewedAt: string;
}

// ============================================
// API 响应类型
// ============================================

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

// ============================================
// 请求体类型
// ============================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export interface CreateShareRequest {
  projectId: string;
  password?: string;
  expiresAt?: string;
  maxViews?: number;
  isOneTime?: boolean;
}

export interface UpdateShareRequest {
  password?: string;
  expiresAt?: string;
  maxViews?: number;
  isOneTime?: boolean;
  isActive?: boolean;
}

export interface VerifyPasswordRequest {
  password: string;
}

// ============================================
// 前端状态类型
// ============================================

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}