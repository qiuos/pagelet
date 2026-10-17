// Run after pnpm build: node apps/server/scripts/check-loading-zip.cjs [sample.zip]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const AdmZip = require('adm-zip');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pagelet-zip-check-'));
process.env.DATABASE_PATH = path.join(temp, 'db.sqlite');
process.env.UPLOADS_DIR = path.join(temp, 'uploads');
process.env.PROJECTS_DIR = path.join(temp, 'projects');
process.env.JWT_SECRET = 'regression-check-only-secret';
process.env.NODE_ENV = 'production';
const dist = path.resolve(__dirname, '../dist');
const storage = require(path.join(dist, 'services/storageService'));
const users = require(path.join(dist, 'services/userService'));
const projects = require(path.join(dist, 'services/projectService'));
const shares = require(path.join(dist, 'services/shareService'));
const thumbnails = require(path.join(dist, 'services/thumbnailService'));
const db = require(path.join(dist, 'models/db')).default;
// Uploaded scripts must not execute during this check; browser rendering tested separately.
thumbnails.generateThumbnail = async () => null;
const owner = users.createUser('admin', 'check-password', 'Owner', 'admin');
const other = users.createUser('other', 'check-password', 'Other');
const { generateToken } = require(path.join(dist, 'utils/jwt'));
const token = generateToken({ userId: owner.id, username: owner.username, role: owner.role });
const otherToken = generateToken({ userId: other.id, username: other.username, role: other.role });
const server = require(path.join(dist, 'app')).default.listen(0, '127.0.0.1');
const publicDir = path.resolve(__dirname, '../public');
const assetPath = path.join(publicDir, 'assets', 'regression-01234567.js');
const indexPath = path.join(publicDir, 'index.html');
const madeIndex = !fs.existsSync(indexPath);
const madePublicDir = !fs.existsSync(publicDir);
const madeAssetsDir = !fs.existsSync(path.dirname(assetPath));
assert(!fs.existsSync(assetPath));
fs.mkdirSync(path.dirname(assetPath), { recursive: true });
fs.writeFileSync(assetPath, '/* static compression check */'.repeat(100));
if (madeIndex) fs.writeFileSync(indexPath, '<html>SPA cache check</html>');

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, buffer, text: buffer.toString(),
          json: () => JSON.parse(buffer.toString()) });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
function cookies(response) {
  return (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ');
}
function file(buffer, originalname = 'site.zip') {
  return { buffer, originalname, size: buffer.length };
}
function zipOf(entries) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.from(content));
  return zip;
}
async function upload(buffer, name = 'Fixture') {
  const boundary = 'pagelet-regression-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="site.zip"\r\nContent-Type: application/zip\r\n\r\n`),
    buffer, Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  return request('/api/projects', { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`
  }, body });
}
function rejectZip(zip, label) {
  assert.throws(() => storage.processZipFile(label, file(zip.toBuffer())), undefined, label);
  assert(!fs.existsSync(path.join(process.env.PROJECTS_DIR, label)), label);
  assert(!fs.readdirSync(process.env.UPLOADS_DIR).some(name => name.startsWith(label + '_')), label);
}

(async () => {
  await new Promise(resolve => server.once('listening', resolve));
  const fixture = {};
  for (const dir of ['h5', 'web']) {
    for (const page of ['report-list', 'detail', 'edit', 'home', '中文']) {
      fixture[`原型/${dir}/${page}.html`] = '<link rel="stylesheet" href="../css/site.css"><a href="detail.html?item=1">Detail</a><script src="../js/site.js"></script>' + ' content'.repeat(300);
    }
  }
  Object.assign(fixture, {
    '原型/css/site.css': '@import "nested/theme.css"; body { background: url(../img/logo.svg) }',
    '原型/css/nested/theme.css': '@font-face { font-family: demo; src: url(../../fonts/demo.woff2) }',
    '原型/js/site.js': 'console.log("fixture")',
    '原型/img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    '原型/fonts/demo.woff2': 'font-fixture',
    '__MACOSX/原型/._home.html': 'ignore',
    '原型/.DS_Store': 'ignore'
  });
  const zip = zipOf(fixture);
  const created = await upload(zip.toBuffer());
  assert.equal(created.status, 201, created.text);
  const project = created.json().data;
  assert.equal(project.fileType, 'zip');
  assert.equal(project.fileSize, zip.toBuffer().length);
  assert.equal(project.entryFiles.length, 10);
  assert.equal(storage.listProjectFiles(project.id).length, 15);
  assert.equal(project.entryFile, [...project.entryFiles].sort()[0]);
  const entryFile = '原型/web/report-list.html';
  const changed = await request(`/api/projects/${project.id}`, { method: 'PUT', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ entryFile }) });
  assert.equal(changed.status, 200, changed.text);
  assert.equal(projects.findProjectById(project.id).entryFile, entryFile);
  const detail = await request(`/api/projects/${project.id}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(detail.json().data.entryFiles.length, 10);
  const listing = await request('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
  assert(!('entryFiles' in listing.json().data[0]));
  for (const invalid of ['../outside.html', '/index.html', '原型/js/site.js', 'missing.html', null, {}, '原型\\web\\home.html']) {
    const response = await request(`/api/projects/${project.id}`, { method: 'PUT', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ entryFile: invalid }) });
    assert(response.status >= 400 && response.status < 500, response.text);
    assert.equal(projects.findProjectById(project.id).entryFile, entryFile);
  }

  const share = shares.createShare(project.id, owner.id, { password: 'site-password', maxViews: 1 });
  const base = `/api/s/${share.slug}/view`;
  const metadata = (await request(`/api/s/${share.slug}`)).json().data;
  assert(!('password' in metadata.share));
  assert(!('passwordHash' in metadata.share));
  assert.equal((await request(base, { headers: { Cookie: `share_token_${share.slug}=1`, 'x-share-token': '1' } })).status, 401);
  assert.equal((await request(`/api/s/${share.slug}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"wrong"}' })).status, 400);
  const verified = await request(`/api/s/${share.slug}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"site-password"}' });
  assert.equal(verified.status, 200);
  assert(verified.headers['set-cookie'][0].includes('HttpOnly'));
  let cookie = cookies(verified);
  const redirected = await request(base + '?item=42', { headers: { Cookie: cookie } });
  assert.equal(redirected.status, 302);
  assert(redirected.headers.location.endsWith('/report-list.html?item=42'));
  assert.equal(shares.findShareById(share.id).viewCount, 0);
  const page = await request(redirected.headers.location, { headers: { Cookie: cookie, 'Accept-Encoding': 'gzip' } });
  assert.equal(page.status, 200);
  assert.equal(page.headers['content-encoding'], 'gzip');
  assert.match(page.headers.vary, /Accept-Encoding/);
  assert.match(page.headers['cache-control'], /no-store/);
  cookie += '; ' + cookies(page);
  assert.equal(shares.findShareById(share.id).viewCount, 1);
  const pageUrl = new URL('http://localhost' + redirected.headers.location);
  for (const relative of ['detail.html?item=1', '中文.html', '../css/site.css?v=1', '../css/nested/theme.css', '../js/site.js', '../img/logo.svg', '../fonts/demo.woff2']) {
    const url = new URL(relative, pageUrl);
    const resource = await request(url.pathname + url.search, { headers: { Cookie: cookie } });
    assert.equal(resource.status, 200, relative + ': ' + resource.text);
    assert.match(resource.headers['cache-control'], /no-store/);
  }
  assert.equal(shares.findShareById(share.id).viewCount, 1);
  assert.equal((await request(base, { headers: { Cookie: cookie } })).status, 400);
  assert.equal((await request(redirected.headers.location.replace('/web/report-list', '/web/./report-list'), { headers: { Cookie: cookie } })).status, 400);
  assert.equal((await request(base + '/%E5%8E%9F%E5%9E%8B/css/site.css')).status, 401);
  const anotherShare = shares.createShare(project.id, owner.id, { password: 'other-password' });
  assert.equal((await request(`/api/s/${anotherShare.slug}/view`, { headers: { Cookie: cookie } })).status, 401);
  shares.updateShare(share.id, { isActive: false });
  assert.equal((await request(new URL('../css/site.css', pageUrl).pathname, { headers: { Cookie: cookie } })).status, 400);
  shares.updateShare(share.id, { isActive: true, expiresAt: '2000-01-01T00:00:00Z' });
  assert.equal((await request(new URL('../css/site.css', pageUrl).pathname, { headers: { Cookie: cookie } })).status, 400);

  const oneTime = shares.createShare(project.id, owner.id, { isOneTime: true });
  const oneBase = `/api/s/${oneTime.slug}/view`;
  const oneRedirect = await request(oneBase);
  const onePage = await request(oneRedirect.headers.location);
  assert.equal(onePage.status, 200);
  const oneCookie = cookies(onePage);
  assert.equal((await request(new URL('../css/site.css', 'http://localhost' + oneRedirect.headers.location).pathname, { headers: { Cookie: oneCookie } })).status, 200);
  assert.equal((await request(oneBase, { headers: { Cookie: oneCookie } })).status, 400);
  assert.equal((await request(new URL('../css/site.css', 'http://localhost' + oneRedirect.headers.location).pathname)).status, 400);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 31 * 60 * 1000;
    const limited = shares.findShareById(oneTime.id);
    const { hasShareCookie } = require(path.join(dist, 'utils/shareToken'));
    const [cookieName, cookieValue] = oneCookie.split('=');
    assert(!hasShareCookie({ cookies: { [cookieName]: cookieValue } }, limited, 'visit'));
  } finally {
    Date.now = originalNow;
  }
  const open = shares.createShare(project.id, owner.id);
  for (const bad of ['%2e%2e%2foutside.html', '%2Fetc%2Fpasswd', '%5c..%5csecret', '.thumbnail.jpg']) {
    assert((await request(`/api/s/${open.slug}/view/${bad}`)).status >= 400);
  }
  const outside = path.join(temp, 'outside.html');
  fs.writeFileSync(outside, 'secret');
  fs.symlinkSync(outside, path.join(process.env.PROJECTS_DIR, project.id, 'link.html'));
  assert.throws(() => storage.validateEntryFile(project.id, 'link.html'));
  assert.equal((await request(`/api/s/${open.slug}/view/link.html`)).status, 400);
  fs.unlinkSync(path.join(process.env.PROJECTS_DIR, project.id, 'link.html'));

  const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"username":"admin","password":"check-password"}' });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/);
  fs.writeFileSync(path.join(process.env.PROJECTS_DIR, project.id, '.thumbnail.jpg'), Buffer.from('thumbnail-first'));
  const thumbUrl = projects.findProjectById(project.id).thumbnail;
  assert(thumbUrl.startsWith(`/api/projects/${project.id}/thumbnail?v=`));
  assert.equal((await request(thumbUrl)).status, 401);
  assert.equal((await request(thumbUrl, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 403);
  const thumb = await request(thumbUrl, { headers: { Cookie: cookies(login) } });
  assert.equal(thumb.status, 200);
  assert.equal(thumb.text, 'thumbnail-first');
  assert.equal(thumb.headers['cache-control'], 'private, no-cache');
  assert.equal((await request(thumbUrl, { headers: { Cookie: cookies(login), 'If-None-Match': thumb.headers.etag } })).status, 304);
  fs.writeFileSync(path.join(process.env.PROJECTS_DIR, project.id, '.thumbnail.jpg'), 'thumbnail-replaced-longer');
  assert.notEqual(projects.findProjectById(project.id).thumbnail, thumbUrl);
  const boundary = 'pagelet-thumbnail-boundary';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
  const thumbBody = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="thumbnail"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const uploadedThumb = await request(`/api/projects/${project.id}/thumbnail/upload`, { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`
  }, body: thumbBody });
  assert.equal(uploadedThumb.status, 200, uploadedThumb.text);
  assert(uploadedThumb.json().data.thumbnail.startsWith(`/api/projects/${project.id}/thumbnail?v=`));
  assert.deepEqual((await request(uploadedThumb.json().data.thumbnail, { headers: { Cookie: cookies(login) } })).buffer, png);
  const stale = { resolving: null };
  const originalGenerate = thumbnails.generateThumbnail;
  thumbnails.generateThumbnail = async (projectId, htmlPath) => {
    await new Promise(resolve => { stale.resolving = resolve; });
    return originalGenerate(projectId, htmlPath);
  };
  const put = await request(`/api/projects/${project.id}`, { method: 'PUT', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ entryFile: '原型/h5/home.html' }) });
  assert.equal(put.status, 200, put.text);
  assert(projects.findProjectById(project.id).entryFile === '原型/h5/home.html');
  assert(stale.resolving === null || typeof stale.resolving === 'function');
  const change = await request(`/api/projects/${project.id}`, { method: 'PUT', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ entryFile: '原型/web/edit.html' }) });
  assert.equal(change.status, 200, change.text);
  assert.equal(projects.findProjectById(project.id).entryFile, '原型/web/edit.html');
  const same = await request(`/api/projects/${project.id}`, { method: 'PUT', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ entryFile: '原型/web/edit.html' }) });
  assert.equal(same.status, 200, same.text);
  while (typeof stale.resolving === 'function') {
    const pending = stale.resolving;
    await new Promise(resolve => setTimeout(resolve, 5));
    if (stale.resolving === pending) { stale.resolving = null; pending(); }
    if (!stale.resolving) break;
  }
  thumbnails.generateThumbnail = originalGenerate;
  assert((await request('/api/projects/' + project.id, { headers: { Authorization: `Bearer ${token}` } })).json().data.thumbnail.startsWith(`/api/projects/${project.id}/thumbnail?v=`));
  const logout = await request('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.match(logout.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  const me = await request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.match(me.headers['set-cookie'][0], /HttpOnly/);

  const staticAsset = await request('/assets/regression-01234567.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(staticAsset.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(staticAsset.headers['content-encoding'], 'gzip');
  assert.equal((await request('/api/not-found')).status, 404);
  assert.equal((await request('/index.html')).headers['cache-control'], 'no-cache');
  assert.equal((await request('/dashboard')).headers['cache-control'], 'no-cache');
  const single = storage.processHtmlFile('single', file(Buffer.from('<html>single</html>'), '中文.htm'));
  assert.equal(single.entryFile, 'index.htm');
  const indexZip = zipOf({ 'nested/a.html': 'a', 'index.htm': 'root', 'index.html': 'root html' });
  assert.equal(storage.processZipFile('root-index', file(indexZip.toBuffer())).entryFile, 'index.html');
  rejectZip(zipOf({ 'assets/main.js': 'no html' }), 'no-html');
  for (const bad of ['../escape.html', '/absolute.html', 'C:/windows.html', 'a\\evil.html']) {
    const unsafe = zipOf({ 'safe.html': 'unsafe' });
    unsafe.getEntry('safe.html').entryName = bad;
    rejectZip(unsafe, 'unsafe-' + Math.random().toString(36).slice(2));
  }
  const symlink = zipOf({ 'index.html': 'target' });
  symlink.getEntry('index.html').attr = (0xa1ff << 16) >>> 0;
  rejectZip(symlink, 'symlink');
  const huge = zipOf({ 'index.html': 'x' });
  huge.getEntry('index.html').header.size = 101 * 1024 * 1024;
  rejectZip(huge, 'huge');
  const count = new AdmZip();
  for (let i = 0; i < 10001; i++) count.addFile(`dir${i}/`, Buffer.alloc(0));
  rejectZip(count, 'count');
  const countBefore = projects.findProjectsByUserId(owner.id).length;
  const failedUpload = await upload(zipOf({ 'no-html.txt': 'x' }).toBuffer());
  assert(failedUpload.status >= 400);
  assert.equal(projects.findProjectsByUserId(owner.id).length, countBefore);

  if (process.argv[2]) {
    const sample = storage.processZipFile('provided-sample', file(fs.readFileSync(process.argv[2])));
    assert.equal(sample.entryFiles.length, 10);
    assert.equal(storage.listProjectFiles('provided-sample').length, 15);
    assert(sample.entryFiles.some(name => name.endsWith('web/report-list.html')));
    assert(sample.entryFiles.some(name => name.endsWith('h5/report-list.html')));
    console.log('Provided ZIP: 15 files, 10 HTML entries; metadata excluded.');
  }
  console.log('PASS: ZIP entries/persistence, relative site paths, auth/cookies, final-visit assets, revocation, cache/gzip, traversal/symlink/size/count/rollback.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(assetPath, { force: true });
  if (madeIndex) fs.rmSync(indexPath, { force: true });
  if (madeAssetsDir) fs.rmdirSync(path.dirname(assetPath));
  if (madePublicDir) fs.rmdirSync(publicDir);
});
