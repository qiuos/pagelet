import { useEffect, useMemo, useRef, useState } from 'react';
import { pageTree, pageUrl, type PageNode } from './sharePageTree';

const control = 'min-h-11 rounded-lg px-3 text-sm text-dark-text-primary hover:bg-dark-bg-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2';

function PageList({ nodes, selected, onSelect }: {
  nodes: PageNode[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <PageItem key={node.path} node={node} selected={selected} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function PageItem({ node, selected, onSelect }: {
  node: PageNode;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li className="min-w-0">
      {node.children ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className={`${control} flex w-full items-center gap-2 text-left`}
            title={node.path}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 3 5 5-5 5" /></svg>
            <span className="truncate">{node.name}</span>
          </button>
          <div hidden={!expanded} className="ml-3 border-l border-dark-border pl-2">
            <PageList nodes={node.children} selected={selected} onSelect={onSelect} />
          </div>
        </>
      ) : (
        <button
          type="button"
          aria-current={selected === node.path ? 'page' : undefined}
          onClick={() => onSelect(node.path)}
          title={node.path}
          className={`${control} block w-full truncate text-left ${selected === node.path ? 'bg-accent/20 font-semibold' : ''}`}
        >
          {node.name}
        </button>
      )}
    </li>
  );
}

export default function ShareNavigation({ slug, name, pages, entryFile }: {
  slug: string;
  name: string;
  pages: string[];
  entryFile?: string;
}) {
  const [selected, setSelected] = useState(entryFile || pages[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => pageTree(pages), [pages]);

  useEffect(() => {
    if (drawerOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [drawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const selectPage = (path: string) => {
    setSelected(path);
    setDrawerOpen(false);
  };
  const list = <PageList nodes={tree} selected={selected} onSelect={selectPage} />;

  return (
    <div className="fixed inset-0 flex bg-dark-bg-primary text-dark-text-primary">
      {sidebarOpen && (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-dark-border bg-dark-bg-secondary md:flex" aria-label="页面目录">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-dark-border px-3">
            <h1 className="truncate text-sm font-semibold">页面目录</h1>
            <button type="button" className={control} onClick={() => setSidebarOpen(false)}>收起目录</button>
          </div>
          <nav className="min-h-0 flex-1 overflow-auto p-2" aria-label="分享页面">{list}</nav>
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="hidden min-h-14 items-center gap-3 border-b border-dark-border px-3 md:flex">
          {!sidebarOpen && <button type="button" className={`${control} shrink-0`} onClick={() => setSidebarOpen(true)}>页面目录</button>}
          <p className="truncate text-sm text-dark-text-secondary" title={selected} aria-live="polite">{selected}</p>
        </header>
        <iframe src={pageUrl(slug, selected)} title={`${name} — ${selected}`} className="min-h-0 w-full flex-1 border-0" />
      </main>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="share-page-drawer" onClick={() => setDrawerOpen(true)} className={`${control} fixed left-3 top-3 border border-dark-border bg-dark-bg-secondary shadow-lg md:hidden`}>页面目录</button>
      <dialog
        ref={dialog}
        id="share-page-drawer"
        aria-labelledby="share-page-drawer-title"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[calc(100%-3rem)] border-0 border-r border-dark-border bg-dark-bg-secondary p-0 text-dark-text-primary backdrop:bg-black/60"
        onClose={() => { setDrawerOpen(false); trigger.current?.focus(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setDrawerOpen(false);
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-dark-border px-3">
            <h2 id="share-page-drawer-title" className="text-sm font-semibold">页面目录</h2>
            <button type="button" autoFocus className={control} onClick={() => setDrawerOpen(false)}>关闭目录</button>
          </div>
          <p className="truncate border-b border-dark-border px-3 py-3 text-sm text-dark-text-secondary" title={selected}>{selected}</p>
          <nav className="min-h-0 flex-1 overflow-auto p-2" aria-label="分享页面">{list}</nav>
        </div>
      </dialog>
    </div>
  );
}
