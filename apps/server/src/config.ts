import { config } from 'dotenv';
config();

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  databasePath: string;
  uploadsDir: string;
  projectsDir: string;
  maxFileSize: number;
  adminUsername: string;
  corsOrigins: string[];
}

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  databasePath: process.env.DATABASE_PATH || './data/data.db',
  uploadsDir: process.env.UPLOADS_DIR || './data/uploads',
  projectsDir: process.env.PROJECTS_DIR || './data/projects',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000']
};