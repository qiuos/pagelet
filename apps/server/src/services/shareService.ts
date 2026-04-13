import db from '../models/db';
import { Share, ViewLog } from '@pagelet/shared';
import { generateUuid, generateSlug } from '../utils/slug';
import bcrypt from 'bcrypt';

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

interface DbViewLog {
  id: string;
  share_id: string;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  viewed_at: string;
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

/**
 * 创建分享链接
 */
export function createShare(
  projectId: string,
  createdBy: string,
  options: {
    password?: string;
    expiresAt?: string;
    maxViews?: number;
    isOneTime?: boolean;
  } = {}
): Share {
  const id = generateUuid();
  const slug = generateSlug(8);
  const passwordHash = options.password ? bcrypt.hashSync(options.password, 12) : null;
  const plainPassword = options.password || null;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO shares (id, project_id, slug, password_hash, password, expires_at, view_count, max_views, is_one_time, is_active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
  `).run(
    id,
    projectId,
    slug,
    passwordHash,
    plainPassword,
    options.expiresAt || null,
    options.maxViews || null,
    options.isOneTime ? 1 : 0,
    createdBy,
    now
  );

  return findShareBySlug(slug)!;
}

/**
 * 根据 slug 查找分享链接
 */
export function findShareBySlug(slug: string): Share | null {
  const row = db.prepare('SELECT * FROM shares WHERE slug = ?').get(slug) as DbShare | undefined;
  return row ? rowToShare(row) : null;
}

/**
 * 根据 ID 查找分享链接
 */
export function findShareById(id: string): Share | null {
  const row = db.prepare('SELECT * FROM shares WHERE id = ?').get(id) as DbShare | undefined;
  return row ? rowToShare(row) : null;
}

/**
 * 获取项目的所有分享链接
 */
export function findSharesByProjectId(projectId: string): Share[] {
  const rows = db.prepare(`
    SELECT * FROM shares WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as DbShare[];
  return rows.map(rowToShare);
}

/**
 * 获取用户创建的所有分享链接
 */
export function findSharesByUserId(userId: string): Share[] {
  const rows = db.prepare(`
    SELECT * FROM shares WHERE created_by = ? ORDER BY created_at DESC
  `).all(userId) as DbShare[];
  return rows.map(rowToShare);
}

/**
 * 更新分享链接
 */
export function updateShare(
  id: string,
  updates: {
    password?: string;
    expiresAt?: string;
    maxViews?: number;
    isOneTime?: boolean;
    isActive?: boolean;
  }
): Share | null {
  const share = findShareById(id);
  if (!share) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.password !== undefined) {
    setClauses.push('password_hash = ?');
    params.push(updates.password ? bcrypt.hashSync(updates.password, 12) : null);
    setClauses.push('password = ?');
    params.push(updates.password || null);
  }

  if (updates.expiresAt !== undefined) {
    setClauses.push('expires_at = ?');
    params.push(updates.expiresAt);
  }

  if (updates.maxViews !== undefined) {
    setClauses.push('max_views = ?');
    params.push(updates.maxViews);
  }

  if (updates.isOneTime !== undefined) {
    setClauses.push('is_one_time = ?');
    params.push(updates.isOneTime ? 1 : 0);
  }

  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }

  if (setClauses.length === 0) return share;

  setClauses.push('updated_at = ?');
  params.push(now);

  params.push(id);

  db.prepare(`
    UPDATE shares SET ${setClauses.join(', ')} WHERE id = ?
  `).run(...params);

  return findShareById(id);
}

/**
 * 删除分享链接
 */
export function deleteShare(id: string): void {
  db.prepare('DELETE FROM shares WHERE id = ?').run(id);
}

/**
 * 验证分享链接是否有效
 */
export function validateShare(share: Share, password?: string): { valid: boolean; error?: string } {
  // 检查是否激活
  if (!share.isActive) {
    return { valid: false, error: '分享链接已被禁用' };
  }

  // 检查是否过期
  if (share.expiresAt) {
    const expiresAt = new Date(share.expiresAt);
    if (expiresAt < new Date()) {
      return { valid: false, error: '分享链接已过期' };
    }
  }

  // 检查访问次数限制
  if (share.maxViews && share.viewCount >= share.maxViews) {
    return { valid: false, error: '分享链接已达到最大访问次数' };
  }

  // 检查一次性链接
  if (share.isOneTime && share.viewCount >= 1) {
    return { valid: false, error: '一次性链接已失效' };
  }

  // 检查密码
  if (share.passwordHash) {
    if (!password) {
      return { valid: false, error: '需要输入密码' };
    }
    if (!bcrypt.compareSync(password, share.passwordHash)) {
      return { valid: false, error: '密码错误' };
    }
  }

  return { valid: true };
}

/**
 * 增加访问计数
 */
export function incrementViewCount(shareId: string): void {
  db.prepare(`
    UPDATE shares SET view_count = view_count + 1 WHERE id = ?
  `).run(shareId);
}

/**
 * 记录访问日志
 */
export function logView(
  shareId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    referer?: string;
  } = {}
): ViewLog {
  const id = generateUuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO view_logs (id, share_id, ip_address, user_agent, referer, viewed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, shareId, options.ipAddress || null, options.userAgent || null, options.referer || null, now);

  return {
    id,
    shareId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    referer: options.referer,
    viewedAt: now
  };
}

/**
 * 获取分享链接的访问日志
 */
export function getViewLogs(shareId: string, limit: number = 100): ViewLog[] {
  const rows = db.prepare(`
    SELECT * FROM view_logs WHERE share_id = ? ORDER BY viewed_at DESC LIMIT ?
  `).all(shareId, limit) as DbViewLog[];

  return rows.map(row => ({
    id: row.id,
    shareId: row.share_id,
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
    referer: row.referer || undefined,
    viewedAt: row.viewed_at
  }));
}