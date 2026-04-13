import fs from 'fs';
import path from 'path';
import { appConfig } from '../config';
import { createError, AppError } from '../middleware/errorHandler';
import { ERROR_CODES } from '@pagelet/shared';
import AdmZip from 'adm-zip';
import { generateThumbnail } from './thumbnailService';

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 保存上传的文件
 */
export function saveUploadedFile(
  projectId: string,
  file: Express.Multer.File
): { originalPath: string; projectPath: string } {
  ensureDir(appConfig.uploadsDir);
  ensureDir(appConfig.projectsDir);

  // 保存原始文件
  const originalName = `${projectId}_${file.originalname}`;
  const originalPath = path.join(appConfig.uploadsDir, originalName);
  fs.writeFileSync(originalPath, file.buffer);

  // 项目目录
  const projectPath = path.join(appConfig.projectsDir, projectId);

  return { originalPath, projectPath };
}

/**
 * 处理 HTML 单文件上传
 */
export function processHtmlFile(
  projectId: string,
  file: Express.Multer.File
): { entryFile: string; projectPath: string } {
  const { originalPath, projectPath } = saveUploadedFile(projectId, file);

  // 创建项目目录并复制文件
  ensureDir(projectPath);
  const entryFile = file.originalname.endsWith('.htm') ? file.originalname : 'index.html';
  const destPath = path.join(projectPath, entryFile);
  fs.copyFileSync(originalPath, destPath);

  return { entryFile, projectPath };
}

/**
 * 处理 ZIP 包上传
 */
export function processZipFile(
  projectId: string,
  file: Express.Multer.File
): { entryFile: string; projectPath: string } {
  const { originalPath, projectPath } = saveUploadedFile(projectId, file);

  // 创建项目目录
  ensureDir(projectPath);

  // 安全检查：防止 Zip 炸弹
  const compressedSize = file.size;
  const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024; // 500MB

  try {
    const zip = new AdmZip(file.buffer);

    // 检查解压后总大小估算
    const entries = zip.getEntries();
    let estimatedSize = 0;
    for (const entry of entries) {
      estimatedSize += entry.header.size;
      if (estimatedSize > MAX_UNCOMPRESSED_SIZE) {
        fs.unlinkSync(originalPath);
        throw createError(ERROR_CODES.FILE_TOO_LARGE, 'ZIP 包解压后超过大小限制');
      }

      // 防止路径遍历
      if (entry.entryName.includes('..')) {
        fs.unlinkSync(originalPath);
        throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包包含非法路径');
      }
    }

    // 解压
    zip.extractAllTo(projectPath, true);

    // 查找入口文件
    let entryFile = 'index.html';
    const files = fs.readdirSync(projectPath);

    // 如果根目录有 index.html
    if (files.includes('index.html')) {
      entryFile = 'index.html';
    } else if (files.includes('index.htm')) {
      entryFile = 'index.htm';
    } else {
      // 按优先级查找 HTML 文件
      const htmlFiles = files.filter(
        f => f.endsWith('.html') || f.endsWith('.htm')
      );
      if (htmlFiles.length > 0) {
        entryFile = htmlFiles[0];
      }
    }

    return { entryFile, projectPath };
  } catch (err) {
    // 清理
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true });
    }

    if (err instanceof AppError) {
      throw err;
    }

    throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包解析失败');
  }
}

/**
 * 获取项目文件路径
 */
export function getProjectFilePath(projectId: string, relativePath?: string): string {
  const projectPath = path.resolve(appConfig.projectsDir, projectId);

  if (!relativePath) {
    return projectPath;
  }

  // 安全检查：防止路径遍历
  const resolvedPath = path.resolve(projectPath, relativePath);
  if (!resolvedPath.startsWith(projectPath + path.sep) && resolvedPath !== projectPath) {
    throw createError(ERROR_CODES.FILE_PARSE_ERROR, '非法的文件路径');
  }

  return resolvedPath;
}

/**
 * 检查项目文件是否存在
 */
export function projectFileExists(projectId: string, relativePath: string): boolean {
  const filePath = getProjectFilePath(projectId, relativePath);
  return fs.existsSync(filePath);
}

/**
 * 删除项目文件
 */
export function deleteProjectFiles(projectId: string): void {
  // 删除原始文件
  const uploadsDir = appConfig.uploadsDir;
  const files = fs.readdirSync(uploadsDir);
  for (const file of files) {
    if (file.startsWith(projectId + '_')) {
      fs.unlinkSync(path.join(uploadsDir, file));
    }
  }

  // 删除项目目录
  const projectPath = path.join(appConfig.projectsDir, projectId);
  if (fs.existsSync(projectPath)) {
    fs.rmSync(projectPath, { recursive: true });
  }
}

/**
 * 获取项目文件列表
 */
export function listProjectFiles(projectId: string): string[] {
  const projectPath = path.join(appConfig.projectsDir, projectId);

  if (!fs.existsSync(projectPath)) {
    return [];
  }

  const files: string[] = [];
  const walk = (dir: string, base: string = '') => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  };

  walk(projectPath);
  return files;
}