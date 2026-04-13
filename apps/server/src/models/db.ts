import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { appConfig } from '../config';
import { createTables } from './schema';

// 确保数据目录存在
const dataDir = path.dirname(appConfig.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 确保上传和项目目录存在
if (!fs.existsSync(appConfig.uploadsDir)) {
  fs.mkdirSync(appConfig.uploadsDir, { recursive: true });
}
if (!fs.existsSync(appConfig.projectsDir)) {
  fs.mkdirSync(appConfig.projectsDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(appConfig.databasePath);

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

// 创建表
createTables(db);

console.log(`[Database] Connected to ${appConfig.databasePath}`);

export default db;