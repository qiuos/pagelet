// Run from apps/web: node src/components/UploadModal.check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const project = { id: 'created-once', entryFile: '原型/h5/report-list.html', entryFiles: ['原型/h5/report-list.html', '原型/web/report-list.html'] };
const slots = [];
let cursor = 0;
let creates = 0;
let updates = 0;
let uploaded = 0;
let closed = 0;
let failSave = true;
const jsx = (type, props) => ({ type, props: props || {} });
const api = {
  create: async () => { creates++; return { data: { success: true, data: project } }; },
  update: async (id, data) => {
    updates++;
    assert.equal(id, project.id);
    assert.equal(data.entryFile, project.entryFiles[1]);
    if (failSave) throw new Error('offline');
    return { data: { success: true, data: project } };
  },
};
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/UploadModal.tsx`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = {
  exports: {},
  FormData: class { append() {} },
  setTimeout: () => 1,
  clearTimeout() {},
  require: (name) => {
    if (name === '../api/client') return { projectsApi: api };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; }];
      },
      useRef: (initial) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useEffect() {},
    };
    throw new Error(`Unexpected import: ${name}`);
  },
};
vm.runInNewContext(code, context);
const render = () => {
  cursor = 0;
  return context.exports.default({ onClose: () => closed++, onUploaded: () => uploaded++ });
};
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
};
const submit = tree => find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });

(async () => {
  let tree = render();
  find(tree, node => node.props.type === 'file').props.onChange({ target: { files: [{ name: '原型.zip' }] } });
  await submit(render());
  tree = render();
  assert.equal(creates, 1);
  assert.equal(uploaded, 0, 'Multiple entries must not complete before save');
  find(tree, node => node.type === 'select').props.onChange({ target: { value: project.entryFiles[1] } });
  await submit(render());
  tree = render();
  assert(find(tree, node => node.props.role === 'alert'), 'Failed save remains recoverable');
  assert(find(tree, node => node.type === 'select'), 'Failed save retains entry selection');
  assert.equal(uploaded, 0);
  find(tree, node => node.type === 'button' && node.props.children === '保留并关闭').props.onClick();
  assert.equal(closed, 1);
  assert.equal(uploaded, 1, 'Close refreshes list for retained project');
  failSave = false;
  await submit(render());
  assert.equal(creates, 1, 'Retry must not create duplicate project');
  assert.equal(updates, 2);
  assert.equal(uploaded, 2);
  assert(!find(render(), node => node.type === 'select'), 'Successful save completes flow');

  slots.length = 0;
  project.entryFiles = [project.entryFile];
  tree = render();
  find(tree, node => node.props.type === 'file').props.onChange({ target: { files: [{ name: 'page.html' }] } });
  await submit(render());
  assert(!find(render(), node => node.type === 'select'), 'Single HTML skips selection');
  assert.equal(updates, 2, 'Single HTML needs no extra PUT');
  assert.equal(uploaded, 3);
  console.log('PASS upload entry save/retry/retain and single HTML flow');
})().catch(error => { console.error(error); process.exitCode = 1; });
