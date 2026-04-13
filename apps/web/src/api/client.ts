import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { ApiError } from '@pagelet/shared';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // 未授权，清除登录状态
      useAuthStore.getState().logout();
      // 跳转到登录页
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// 认证 API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// 项目 API
export const projectsApi = {
  list: (query?: { q?: string; status?: string }) =>
    api.get('/projects', { params: query }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (formData: FormData, options?: { onUploadProgress?: (e: any) => void }) =>
    api.post('/projects', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: options?.onUploadProgress,
    }),
  update: (id: string, data: { name?: string; description?: string; status?: string }) =>
    api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  preview: (id: string) => api.get(`/projects/${id}/preview`),
  regenerateThumbnail: (id: string) =>
    api.post(`/projects/${id}/thumbnail/regenerate`),
  uploadThumbnail: (id: string, formData: FormData) =>
    api.post(`/projects/${id}/thumbnail/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// 分享 API
export const sharesApi = {
  list: () => api.get('/shares'),
  listByProject: (projectId: string) => api.get(`/shares/project/${projectId}`),
  create: (data: {
    projectId: string;
    password?: string;
    expiresAt?: string;
    maxViews?: number;
    isOneTime?: boolean;
  }) => api.post('/shares', data),
  update: (id: string, data: {
    password?: string;
    expiresAt?: string;
    maxViews?: number;
    isOneTime?: boolean;
    isActive?: boolean;
  }) => api.put(`/shares/${id}`, data),
  delete: (id: string) => api.delete(`/shares/${id}`),
};

// 公开 API (使用 /s 路径，需要通过后端处理)
// 注意：publicApi 不使用 /api 前缀，直接访问 /s 路径
export const publicApi = {
  getShare: (slug: string) => axios.get(`/api/s/${slug}`),
  verifyPassword: (slug: string, password: string) =>
    axios.post(`/api/s/${slug}/verify`, { password }),
};

// 用户管理 API (管理员)
export const usersApi = {
  list: () => api.get('/users'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: { username: string; password: string; name: string; role?: 'admin' | 'member' }) =>
    api.post('/users', data),
  update: (id: string, data: { username?: string; name?: string; role?: 'admin' | 'member' }) =>
    api.put(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  delete: (id: string) => api.delete(`/users/${id}`),
  stats: () => api.get('/users/stats'),
};