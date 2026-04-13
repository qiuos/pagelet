import Database from 'better-sqlite3';

export function createTables(db: Database.Database): void {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 项目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      file_type TEXT,
      file_size INTEGER,
      entry_file TEXT DEFAULT 'index.html',
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 分享链接表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      slug TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password TEXT,
      expires_at DATETIME,
      view_count INTEGER DEFAULT 0,
      max_views INTEGER,
      is_one_time BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 兼容旧数据库：添加 password 列
  try {
    db.exec(`ALTER TABLE shares ADD COLUMN password TEXT`);
  } catch (_) {
    // 列已存在，忽略
  };

  // 访问日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS view_logs (
      id TEXT PRIMARY KEY,
      share_id TEXT REFERENCES shares(id),
      ip_address TEXT,
      user_agent TEXT,
      referer TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shares_slug ON shares(slug);
    CREATE INDEX IF NOT EXISTS idx_shares_project ON shares(project_id);
    CREATE INDEX IF NOT EXISTS idx_view_logs_share ON view_logs(share_id);
    CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
  `);
}