import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { appConfig } from '../config';
import { pathToFileURL } from 'url';
import { getProjectFilePath } from './storageService';
import { findProjectById } from './projectService';

// Get absolute path for projects directory
const getProjectsDir = () => {
  return path.isAbsolute(appConfig.projectsDir)
    ? appConfig.projectsDir
    : path.resolve(process.cwd(), appConfig.projectsDir);
};

/**
 * 生成项目缩略图
 * @param projectId 项目 ID
 * @param htmlPath HTML 文件路径
 * @returns 缩略图的认证 URL
 */
export async function generateThumbnail(projectId: string, htmlPath: string): Promise<string | null> {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // 设置视口大小
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1,
    });

    // 确保 htmlPath 是绝对路径
    const absoluteHtmlPath = path.isAbsolute(htmlPath)
      ? htmlPath
      : path.resolve(process.cwd(), htmlPath);

    // 缩略图只渲染静态内容，不执行上传脚本或请求外部网络。
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    const projectRoot = pathToFileURL(getProjectFilePath(projectId) + path.sep).href;
    page.on('request', request => {
      if (request.url().startsWith(projectRoot) || request.url().startsWith('data:')) request.continue();
      else request.abort();
    });
    const fileUrl = pathToFileURL(absoluteHtmlPath).href;
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 10000,
    });

    // 等待一下让页面完全渲染
    await new Promise(resolve => setTimeout(resolve, 500));

    // 截图
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      encoding: 'base64',
    });

    await browser.close();

    // 保存缩略图文件
    const projectsDir = getProjectsDir();
    const thumbnailDir = path.join(projectsDir, projectId);
    const thumbnailPath = path.join(thumbnailDir, '.thumbnail.jpg');

    // 旧任务完成时入口已被用户修改：跳过写盘，避免覆盖新入口封面。
    const current = findProjectById(projectId);
    if (current && getProjectFilePath(projectId, current.entryFile) !== absoluteHtmlPath) {
      console.log('[Thumbnail] Skipped stale generation for:', projectId);
      return getThumbnail(projectId);
    }

    // 确保目录存在
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    fs.writeFileSync(thumbnailPath, Buffer.from(screenshot!, 'base64'));

    return getThumbnail(projectId);
  } catch (error) {
    console.error('[Thumbnail Error]', error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}

/**
 * 获取项目缩略图
 * @param projectId 项目 ID
 * @returns 缩略图的认证 URL，如果不存在则返回 null
 */
export function getThumbnailPath(projectId: string): string | null {
  for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
    const thumbnailPath = path.join(getProjectsDir(), projectId, `.thumbnail.${ext}`);
    if (fs.existsSync(thumbnailPath) && fs.lstatSync(thumbnailPath).isFile()) return thumbnailPath;
  }
  return null;
}

export function getThumbnail(projectId: string): string | null {
  const thumbnailPath = getThumbnailPath(projectId);
  if (!thumbnailPath) return null;
  const stat = fs.statSync(thumbnailPath);
  return `/api/projects/${projectId}/thumbnail?v=${stat.mtimeMs}-${stat.size}`;
}

/**
 * 删除项目缩略图
 * @param projectId 项目 ID
 */
export function deleteThumbnail(projectId: string): void {
  const projectsDir = getProjectsDir();
  const thumbnailPath = path.join(projectsDir, projectId, '.thumbnail.jpg');

  if (fs.existsSync(thumbnailPath)) {
    fs.unlinkSync(thumbnailPath);
  }
}