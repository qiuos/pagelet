import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { appConfig } from '../config';

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
 * @returns 缩略图的 base64 数据
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
        '--disable-web-security',
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

    // 加载 HTML 文件
    const fileUrl = `file://${absoluteHtmlPath}`;
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

    // 确保目录存在
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    fs.writeFileSync(thumbnailPath, Buffer.from(screenshot!, 'base64'));

    return `data:image/jpeg;base64,${screenshot}`;
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
 * @returns 缩略图的 base64 数据，如果不存在则返回 null
 */
export function getThumbnail(projectId: string): string | null {
  const projectsDir = getProjectsDir();
  const thumbnailPath = path.join(projectsDir, projectId, '.thumbnail.jpg');

  if (fs.existsSync(thumbnailPath)) {
    try {
      const buffer = fs.readFileSync(thumbnailPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  return null;
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