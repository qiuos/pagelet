import fs from 'fs';
import path from 'path';
import { inflateRawSync } from 'zlib';
import { appConfig } from '../config';
import { createError, AppError } from '../middleware/errorHandler';
import { ERROR_CODES } from '@pagelet/shared';
import AdmZip from 'adm-zip';

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function isMetadata(name: string): boolean {
  return name.split('/').some(part => part === '__MACOSX' || part === '.DS_Store' || part.startsWith('._'));
}

function normalizeFilePath(name: string): string {
  if (!name || name.includes('\0') || name.includes('\\') || path.posix.isAbsolute(name) ||
      /^[a-z]:/i.test(name) || name.split('/').includes('..')) {
    throw createError(ERROR_CODES.FILE_PARSE_ERROR, '非法的文件路径');
  }
  const normalized = path.posix.normalize(name).replace(/\/$/, '');
  if (normalized === '.' || normalized.split('/').some(part => part.startsWith('.thumbnail'))) {
    throw createError(ERROR_CODES.FILE_PARSE_ERROR, '非法的文件路径');
  }
  return normalized;
}

export function saveUploadedFile(
  projectId: string,
  file: Express.Multer.File
): { originalPath: string; projectPath: string } {
  ensureDir(appConfig.uploadsDir);
  ensureDir(appConfig.projectsDir);
  const originalName = `${projectId}_${path.basename(file.originalname.replace(/\\/g, '/'))}`;
  const originalPath = path.join(appConfig.uploadsDir, originalName);
  fs.writeFileSync(originalPath, file.buffer);
  return { originalPath, projectPath: path.join(appConfig.projectsDir, projectId) };
}

export function processHtmlFile(
  projectId: string,
  file: Express.Multer.File
): { entryFile: string; entryFiles: string[]; projectPath: string } {
  const { originalPath, projectPath } = saveUploadedFile(projectId, file);
  ensureDir(projectPath);
  const entryFile = file.originalname.toLowerCase().endsWith('.htm') ? 'index.htm' : 'index.html';
  fs.copyFileSync(originalPath, path.join(projectPath, entryFile));
  return { entryFile, entryFiles: [entryFile], projectPath };
}

export function processZipFile(
  projectId: string,
  file: Express.Multer.File
): { entryFile: string; entryFiles: string[]; projectPath: string } {
  const { originalPath, projectPath } = saveUploadedFile(projectId, file);
  const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
  const MAX_ENTRY_SIZE = 100 * 1024 * 1024;
  const MAX_ENTRIES = 10000;

  try {
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRIES) {
      throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包文件数量超过限制');
    }
    let totalSize = 0;
    const names = new Set<string>();
    const files: { entry: AdmZip.IZipEntry; name: string }[] = [];
    for (const entry of entries) {
      const name = normalizeFilePath(entry.entryName);
      const mode = (entry.attr >>> 16) & 0xf000;
      if (mode && mode !== 0x8000 && mode !== 0x4000) {
        throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包包含符号链接或特殊文件');
      }
      totalSize += entry.header.size;
      if (entry.header.size > MAX_ENTRY_SIZE || totalSize > MAX_UNCOMPRESSED_SIZE) {
        throw createError(ERROR_CODES.FILE_TOO_LARGE, 'ZIP 包解压后超过大小限制');
      }
      if (entry.header.encripted || ![0, 8].includes(entry.header.method)) {
        throw createError(ERROR_CODES.FILE_PARSE_ERROR, '不支持加密或此压缩格式的 ZIP 文件');
      }
      if (isMetadata(name)) continue;
      if (names.has(name)) {
        throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包包含重复路径');
      }
      names.add(name);
      if (!entry.isDirectory) files.push({ entry, name });
    }
    const entryFiles = files.map(file => file.name).filter(name => /\.html?$/i.test(name)).sort();
    if (!entryFiles.length) {
      throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包内没有 HTML 文件');
    }
    ensureDir(projectPath);
    for (const { entry, name } of files) {
      // adm-zip bounds nonempty entries; bound zero-size headers too before decoding.
      if (entry.header.size === 0 && entry.header.method === 8) {
        inflateRawSync(entry.getCompressedData(), { maxOutputLength: 1 });
      }
      const data = entry.getData();
      if (data.length !== entry.header.size) {
        throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 文件大小不匹配');
      }
      const destination = getProjectFilePath(projectId, name);
      ensureDir(path.dirname(destination));
      fs.writeFileSync(destination, data, { flag: 'wx' });
    }
    const entryFile = entryFiles.find(name => /^index\.html$/i.test(name)) ||
      entryFiles.find(name => /^index\.htm$/i.test(name)) ||
      entryFiles.find(name => /(^|\/)index\.html?$/i.test(name)) || entryFiles[0];
    return { entryFile, entryFiles, projectPath };
  } catch (err) {
    fs.rmSync(originalPath, { force: true });
    fs.rmSync(projectPath, { recursive: true, force: true });
    if (err instanceof AppError) throw err;
    throw createError(ERROR_CODES.FILE_PARSE_ERROR, 'ZIP 包解析失败');
  }
}

export function getProjectFilePath(projectId: string, relativePath?: string): string {
  const projectPath = path.resolve(appConfig.projectsDir, projectId);
  if (!relativePath) return projectPath;
  const normalized = normalizeFilePath(relativePath);
  const resolvedPath = path.resolve(projectPath, normalized);
  if (!resolvedPath.startsWith(projectPath + path.sep)) {
    throw createError(ERROR_CODES.FILE_PARSE_ERROR, '非法的文件路径');
  }
  // Reject symlinks in existing projects as well as newly extracted archives.
  let current = projectPath;
  for (const part of ['', ...normalized.split('/')]) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw createError(ERROR_CODES.FILE_PARSE_ERROR, '不允许符号链接');
    }
  }
  return resolvedPath;
}

export function projectFileExists(projectId: string, relativePath: string): boolean {
  const filePath = getProjectFilePath(projectId, relativePath);
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

export function validateEntryFile(projectId: string, entryFile: unknown): string {
  if (typeof entryFile !== 'string') {
    throw createError(ERROR_CODES.VALIDATION_ERROR, '入口必须为项目内的 HTML 文件');
  }
  const normalized = normalizeFilePath(entryFile);
  if (!/\.html?$/i.test(normalized) || !projectFileExists(projectId, normalized)) {
    throw createError(ERROR_CODES.VALIDATION_ERROR, '入口必须为项目内已存在的 HTML 文件');
  }
  return normalized;
}

export function deleteProjectFiles(projectId: string): void {
  if (fs.existsSync(appConfig.uploadsDir)) {
    for (const file of fs.readdirSync(appConfig.uploadsDir)) {
      if (file.startsWith(projectId + '_')) fs.unlinkSync(path.join(appConfig.uploadsDir, file));
    }
  }
  fs.rmSync(path.join(appConfig.projectsDir, projectId), { recursive: true, force: true });
}

export function listProjectFiles(projectId: string): string[] {
  const projectPath = getProjectFilePath(projectId);
  if (!fs.existsSync(projectPath)) return [];
  const files: string[] = [];
  const walk = (dir: string, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relativePath = base ? `${base}/${entry.name}` : entry.name;
      if (isMetadata(relativePath) || entry.name.startsWith('.thumbnail') || entry.isSymbolicLink()) continue;
      getProjectFilePath(projectId, relativePath);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  };
  walk(projectPath);
  return files.sort();
}
