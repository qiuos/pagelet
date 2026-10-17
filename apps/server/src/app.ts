import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { appConfig } from './config';
import { errorHandler } from './middleware/errorHandler';
import { loggerMiddleware, corsMiddleware } from './middleware/logger';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import shareRoutes from './routes/shares';
import publicRoutes from './routes/public';
import userRoutes from './routes/users';

const app = express();

// 中间件
app.use(loggerMiddleware);
app.use(corsMiddleware);
app.use(cors({
  origin: appConfig.corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/users', userRoutes);

// 公开访问路由 (通过 /api/s 前缀)
app.use('/api/s', publicRoutes);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 生产环境：提供前端静态文件
if (appConfig.nodeEnv === 'production') {
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir, {
    setHeaders(res, filePath) {
      const isHashedAsset = path.dirname(filePath) === path.join(publicDir, 'assets') &&
        /-[\w-]{8,}\.[^.]+$/.test(path.basename(filePath));
      res.setHeader('Cache-Control', isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
  }));
  // SPA fallback - 非 API 路由返回 index.html
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'index.html'), { cacheControl: false });
  });
}

// 未匹配的 API 不得返回 SPA HTML。
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

// 错误处理
app.use(errorHandler);

export default app;