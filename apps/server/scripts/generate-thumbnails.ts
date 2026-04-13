import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Use absolute path - data directory is at server/data/projects
const PROJECTS_DIR = path.resolve(__dirname, '../data/projects');

async function generateThumbnail(projectId: string, htmlPath: string): Promise<string | null> {
  let browser = null;

  try {
    console.log(`[Thumbnail] Generating for project ${projectId}...`);
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

    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1,
    });

    const fileUrl = `file://${htmlPath}`;
    console.log(`[Thumbnail] Loading ${fileUrl}`);
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      encoding: 'base64',
    });

    await browser.close();

    const thumbnailPath = path.join(PROJECTS_DIR, projectId, '.thumbnail.jpg');
    fs.writeFileSync(thumbnailPath, Buffer.from(screenshot!, 'base64'));

    console.log(`[Thumbnail] Generated successfully for ${projectId}`);
    return `data:image/jpeg;base64,${screenshot}`;
  } catch (error) {
    console.error(`[Thumbnail Error] Failed for ${projectId}:`, error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}

async function main() {
  // Get all project directories
  const projects = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`[Thumbnail] Found ${projects.length} projects`);

  for (const projectId of projects) {
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const thumbnailPath = path.join(projectPath, '.thumbnail.jpg');

    // Skip if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      console.log(`[Thumbnail] Skipping ${projectId} - thumbnail already exists`);
      continue;
    }

    // Find entry HTML file
    let entryFile = 'index.html';
    const files = fs.readdirSync(projectPath);

    if (!files.includes('index.html')) {
      const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.htm'));
      if (htmlFiles.length === 0) {
        console.log(`[Thumbnail] Skipping ${projectId} - no HTML file found`);
        continue;
      }
      entryFile = htmlFiles[0];
    }

    const htmlPath = path.join(projectPath, entryFile);
    await generateThumbnail(projectId, htmlPath);
  }

  console.log('[Thumbnail] Done!');
}

main().catch(console.error);