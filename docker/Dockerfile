# ---- Builder Stage ----
FROM node:20-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

# 先复制依赖描述文件，利用 Docker 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建：shared → web → server
RUN pnpm run build

# ---- Runner Stage ----
FROM node:20-slim AS runner

WORKDIR /app

# Puppeteer 依赖
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-noto \
    fonts-noto-cjk \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 告诉 Puppeteer 使用系统 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN npm install -g pnpm

# 复制 workspace 配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 复制 server 编译产物和源码
COPY --from=builder /app/apps/server ./apps/server

# 复制 shared 编译产物
COPY --from=builder /app/packages/shared ./packages/shared

# 复制前端构建产物到 server/public
COPY --from=builder /app/apps/web/dist ./apps/server/public

# 只安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 数据目录
RUN mkdir -p /app/apps/server/data/uploads /app/apps/server/data/projects

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=./data/data.db
ENV UPLOADS_DIR=./data/uploads
ENV PROJECTS_DIR=./data/projects

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
