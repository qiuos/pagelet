# Pagelet

静态网页展示工具 - 一键上传、安全分享、专业呈现。

## 功能特性

### 项目管理
- 支持 HTML 单文件和 ZIP 压缩包上传
- 自动解压 ZIP 并识别入口文件
- 自动生成封面缩略图（Puppeteer 截图）
- 项目归档、恢复、删除

### 分享链接
- 一键生成公开分享链接（8 位随机 Slug）
- 可选密码保护（访问时需输入密码）
- 灵活的有效期设置（永久 / 1 小时 / 1 天 / 7 天 / 30 天 / 自定义日期）
- 一次性访问链接（阅后即焚）
- 访问次数上限限制
- 复制分享时自动附带密码和有效期信息

### 用户与安全
- 用户名 + 密码登录（JWT 认证）
- 管理员首次启动自动创建，控制台输出随机密码
- 管理员可管理团队成员（创建、编辑、删除）
- 个人设置（修改用户名、显示名称、密码）
- 密码 bcrypt 加密存储

### 界面体验
- 深色 / 浅色主题切换
- 响应式布局，适配桌面和移动端
- 文件上传进度显示
- 分享页面展示分享者名称

## 快速部署（推荐）

### Docker Compose 一键部署

```bash
# 1. 克隆仓库
git clone <repo-url> && cd pagelet

# 2. 启动服务
cd docker
docker compose up -d --build

# 3. 查看初始管理员密码
docker compose logs | grep "管理员"
```

服务启动后访问 **http://localhost:3000**。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `JWT_SECRET` | `please-change-this-...` | JWT 签名密钥，生产环境务必修改 |
| `ADMIN_USERNAME` | `admin` | 管理员用户名（首次启动生效） |
| `CORS_ORIGINS` | `http://localhost:3000` | 允许的跨域来源 |

可在 `docker/docker-compose.yml` 中或通过 `.env` 文件配置。

### 数据持久化

数据通过 Docker Volume `pagelet-data` 持久化，存储在容器内 `/app/apps/server/data/`：

- `data.db` — SQLite 数据库
- `uploads/` — 上传文件
- `projects/` — 解压后的项目文件

### 常用命令

```bash
# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 重新构建并启动
docker compose up -d --build

# 停止服务
docker compose down

# 停止并删除数据
docker compose down -v
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前端 + 后端热更新）
pnpm dev

# 构建生产版本
pnpm build
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 构建 | Turborepo + pnpm (Monorepo) |
| 截图 | Puppeteer + Chromium |
| 部署 | Docker + Docker Compose |

## 项目结构

```
pagelet/
├── apps/
│   ├── web/              # React SPA 前端
│   └── server/           # Express API 后端
├── packages/
│   └── shared/           # 共享类型和常量
├── docker/
│   ├── Dockerfile        # 多阶段构建
│   └── docker-compose.yml
└── data/                 # 数据存储（.gitignore）
```
