import db from '../models/db';
import { Project, ProjectWithShares, FileType, ProjectStatus, Share } from '@pagelet/shared';
import { generateUuid } from '../utils/slug';
import { getThumbnail } from './thumbnailService';

interface DbProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  file_type: string | null;
  file_size: number | null;
  entry_file: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: DbProject): Project {
  const thumbnail = getThumbnail(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    status: row.status as ProjectStatus,
    fileType: (row.file_type || 'html') as FileType,
    fileSize: row.file_size || 0,
    entryFile: row.entry_file,
    thumbnail: thumbnail || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * 创建项目
 */
export function createProject(
  name: string,
  createdBy: string,
  options: {
    description?: string;
    fileType?: FileType;
    fileSize?: number;
    entryFile?: string;
  } = {}
): Project {
  const id = generateUuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, name, description, status, file_type, file_size, entry_file, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    options.description || null,
    options.fileType || 'html',
    options.fileSize || 0,
    options.entryFile || 'index.html',
    createdBy,
    now,
    now
  );

  return findProjectById(id)!;
}

/**
 * 根据 ID 查找项目
 */
export function findProjectById(id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as DbProject | undefined;
  return row ? rowToProject(row) : null;
}

/**
 * 获取用户的所有项目
 */
export function findProjectsByUserId(userId: string): Project[] {
  const rows = db.prepare(`
    SELECT * FROM projects WHERE created_by = ? ORDER BY created_at DESC
  `).all(userId) as DbProject[];
  return rows.map(rowToProject);
}

/**
 * 更新项目
 */
export function updateProject(
  id: string,
  updates: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  }
): Project | null {
  const project = findProjectById(id);
  if (!project) return null;

  const now = new Date().toISOString();
  const name = updates.name ?? project.name;
  const description = updates.description ?? project.description;
  const status = updates.status ?? project.status;

  db.prepare(`
    UPDATE projects SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?
  `).run(name, description || null, status, now, id);

  return findProjectById(id);
}

/**
 * 删除项目及其关联的分享链接
 */
export function deleteProject(id: string): void {
  // 先删除关联的访问日志
  const shareIds = db.prepare('SELECT id FROM shares WHERE project_id = ?').all(id).map((r: any) => r.id);
  if (shareIds.length > 0) {
    db.prepare(`DELETE FROM view_logs WHERE share_id IN (${shareIds.map(() => '?').join(',')})`).run(...shareIds);
  }
  // 再删除关联的分享链接
  db.prepare('DELETE FROM shares WHERE project_id = ?').run(id);
  // 删除项目
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

/**
 * 获取项目及其分享链接
 */
export function findProjectWithShares(id: string): ProjectWithShares | null {
  const project = findProjectById(id);
  if (!project) return null;

  const shares = db.prepare(`
    SELECT * FROM shares WHERE project_id = ? ORDER BY created_at DESC
  `).all(id) as DbShare[];

  return {
    ...project,
    shares: shares.map(rowToShare),
    shareCount: shares.length
  };
}

/**
 * 搜索项目
 */
export function searchProjects(userId: string, query?: string, status?: ProjectStatus): Project[] {
  let sql = 'SELECT * FROM projects WHERE created_by = ?';
  const params: (string | number)[] = [userId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (query) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    const searchPattern = `%${query}%`;
    params.push(searchPattern, searchPattern);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params) as DbProject[];
  return rows.map(rowToProject);
}

// 导入 DbShare 类型和 rowToShare 函数（从 shareService 导入）
interface DbShare {
  id: string;
  project_id: string;
  slug: string;
  password_hash: string | null;
  password: string | null;
  expires_at: string | null;
  view_count: number;
  max_views: number | null;
  is_one_time: number;
  is_active: number;
  created_by: string;
  created_at: string;
}

function rowToShare(row: DbShare): Share {
  return {
    id: row.id,
    projectId: row.project_id,
    slug: row.slug,
    passwordHash: row.password_hash || undefined,
    password: row.password || undefined,
    expiresAt: row.expires_at || undefined,
    viewCount: row.view_count,
    maxViews: row.max_views || undefined,
    isOneTime: Boolean(row.is_one_time),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    hasPassword: !!row.password_hash
  };
}