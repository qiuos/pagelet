export interface PageNode {
  name: string;
  path: string;
  children?: PageNode[];
}

export function htmlPages(files?: string[]): string[] {
  return [...new Set((files || []).filter((path) =>
    typeof path === 'string' && /\.html?$/i.test(path) &&
    !path.includes('\\') && !path.includes('\0') &&
    path.split('/').every((part) => part && part !== '.' && part !== '..')
  ))];
}

export function pageTree(files: string[]): PageNode[] {
  const root: PageNode[] = [];
  for (const file of files) {
    let children = root;
    const parts = file.split('/');
    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let node = children.find((item) => item.path === path);
      if (!node) {
        node = { name, path, ...(index < parts.length - 1 ? { children: [] } : {}) };
        children.push(node);
      }
      if (node.children) children = node.children;
    });
  }
  return root;
}

export function pageUrl(slug: string, path?: string): string {
  return `/api/s/${encodeURIComponent(slug)}/view${path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''}`;
}
