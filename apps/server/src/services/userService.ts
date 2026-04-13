import crypto from 'crypto';
import db from '../models/db';
import { User, UserRole } from '@pagelet/shared';
import { generateUuid } from '../utils/slug';
import bcrypt from 'bcrypt';
import { appConfig } from '../config';

interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: DbUser): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * 根据 ID 查找用户
 */
export function findUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
  return row ? rowToUser(row) : null;
}

/**
 * 根据 ID 查找用户（含密码哈希）
 */
export function findUserByIdWithPassword(id: string): (User & { passwordHash: string }) | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
  if (!row) return null;
  return {
    ...rowToUser(row),
    passwordHash: row.password_hash
  };
}

/**
 * 根据用户名查找用户
 */
export function findUserByUsername(username: string): (User & { passwordHash: string }) | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
  if (!row) return null;
  return {
    ...rowToUser(row),
    passwordHash: row.password_hash
  };
}

/**
 * 创建用户
 */
export function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole = 'member'
): User {
  const id = generateUuid();
  const passwordHash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, name, role, now, now);

  return findUserById(id)!;
}

/**
 * 更新用户密码
 */
export function updateUserPassword(userId: string, newPassword: string): void {
  const passwordHash = bcrypt.hashSync(newPassword, 12);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
  `).run(passwordHash, now, userId);
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash);
}

/**
 * 确保管理员账户存在（系统首次启动时自动创建）
 * 用户名固定为 admin，密码随机生成并打印到控制台
 */
export function ensureAdminUser(): void {
  const admin = findUserByUsername(appConfig.adminUsername);
  if (!admin) {
    const randomPassword = crypto.randomBytes(8).toString('hex');
    console.log('[Init] Admin user created!');
    console.log(`[Init] Username: ${appConfig.adminUsername}`);
    console.log(`[Init] Password: ${randomPassword}`);
    console.log('[Init] Please change the password after first login!');
    createUser(appConfig.adminUsername, randomPassword, '管理员', 'admin');
  }
}

/**
 * 统计用户数量
 */
export function countUsers(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}

/**
 * 获取所有用户
 */
export function findAllUsers(): User[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as DbUser[];
  return rows.map(rowToUser);
}

/**
 * 更新用户信息
 */
export function updateUser(
  id: string,
  updates: {
    username?: string;
    name?: string;
    role?: UserRole;
  }
): User | null {
  const user = findUserById(id);
  if (!user) return null;

  const now = new Date().toISOString();
  const username = updates.username ?? user.username;
  const name = updates.name ?? user.name;
  const role = updates.role ?? user.role;

  db.prepare(`
    UPDATE users SET username = ?, name = ?, role = ?, updated_at = ? WHERE id = ?
  `).run(username, name, role, now, id);

  return findUserById(id);
}

/**
 * 重置用户密码（管理员操作）
 */
export function resetUserPassword(userId: string, newPassword: string): void {
  const passwordHash = bcrypt.hashSync(newPassword, 12);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
  `).run(passwordHash, now, userId);
}

/**
 * 删除用户
 */
export function deleteUser(id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
