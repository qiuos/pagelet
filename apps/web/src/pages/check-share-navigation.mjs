// Run with Node 22.18+ from repository root: node apps/web/src/pages/check-share-navigation.mjs
import assert from 'node:assert/strict';
import { htmlPages, pageTree, pageUrl } from './sharePageTree.ts';

const files = htmlPages([
  'index.html', '文 档/深层/a#100%.HTM', '文 档/other.html',
  'assets/app.js', 'empty/readme.txt', 'index.html', '../escape.html',
  '/absolute.html', 'a//b.html', 'a/./b.html', 'a\\b.html',
]);
assert.deepEqual(files, ['index.html', '文 档/深层/a#100%.HTM', '文 档/other.html']);
assert.deepEqual(pageTree(files), [
  { name: 'index.html', path: 'index.html' },
  { name: '文 档', path: '文 档', children: [
    { name: '深层', path: '文 档/深层', children: [
      { name: 'a#100%.HTM', path: '文 档/深层/a#100%.HTM' },
    ] },
    { name: 'other.html', path: '文 档/other.html' },
  ] },
]);
assert.equal(pageUrl('demo', files[1]), '/api/s/demo/view/%E6%96%87%20%E6%A1%A3/%E6%B7%B1%E5%B1%82/a%23100%25.HTM');
assert.equal(pageUrl('demo'), '/api/s/demo/view');
assert.equal(new URL('../style.css', `https://example.test${pageUrl('demo', files[1])}`).pathname, '/api/s/demo/view/%E6%96%87%20%E6%A1%A3/style.css');
assert.deepEqual(htmlPages(), []);
assert.equal(htmlPages(['only.htm']).length, 1);
assert.deepEqual(pageTree([]), []);
console.log('share navigation: tree, deep paths, filtering, single page, encoding and relative resource URL passed');
