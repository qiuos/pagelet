import { useState, useRef, useEffect } from 'react';
import { projectsApi } from '../api/client';
import type { ApiError, Project } from '@pagelet/shared';

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

type CreationStage = 'form' | 'uploading' | 'processing' | 'entry' | 'complete';

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [stage, setStage] = useState<CreationStage>('form');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [entryFile, setEntryFile] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleClose = () => {
    if (uploading) return;
    if (createdProject && stage !== 'complete') onUploaded();
    onClose();
  };

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    return () => {
      clearTimeout(closeTimer.current);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [stage]);

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
    if (e.key !== 'Tab') return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
    );
    const focusable = Array.from(controls || []).filter(el => el.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) {
      e.preventDefault();
    } else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      first.focus();
    }
  };

  const finishCreation = () => {
    setStage('complete');
    onUploaded();
    closeTimer.current = setTimeout(onClose, 800);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdProject || !entryFile || uploading) return;
    setUploading(true);
    setError('');
    try {
      const response = await projectsApi.update(createdProject.id, { entryFile });
      if (!response.data.success) throw new Error('保存失败');
      finishCreation();
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '默认入口保存失败，请重试。项目已保留，无需重新上传。');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.toLowerCase().slice(droppedFile.name.lastIndexOf('.'));
      if (['.html', '.htm', '.zip'].includes(ext)) {
        setFile(droppedFile);
        if (!name) {
          setName(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setError('只支持 .html 和 .zip 文件');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      if (['.html', '.htm', '.zip'].includes(ext)) {
        setFile(selectedFile);
        if (!name) {
          setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setError('只支持 .html 和 .zip 文件');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createdProject || uploading) return;
    if (!file || !name.trim()) {
      setError('请选择文件并填写项目名称');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setStage('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      const response = await projectsApi.create(formData, {
        onUploadProgress: (e: any) => {
          if (e.total) {
            const progress = Math.round((e.loaded * 100) / e.total);
            setUploadProgress(progress);
            if (progress >= 100) {
              setStage('processing');
            }
          }
        }
      });
      if (!response.data.success) throw new Error('上传失败');
      const project: Project = response.data.data;
      setCreatedProject(project);
      setEntryFile(project.entryFile);
      if ((project.entryFiles?.length || 0) > 1) {
        setStage('entry');
      } else {
        finishCreation();
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '上传失败');
      setStage('form');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="apple-card w-full max-w-lg overflow-hidden border-[var(--border)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] shrink-0">
          <h2 id="upload-title" className="text-xl font-bold tracking-tight">创建新项目</h2>
          <button
            onClick={handleClose}
            aria-label={createdProject ? '关闭并保留项目' : '关闭创建项目'}
            disabled={uploading}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors text-xl font-light disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {stage === 'form' ? (
          /* 表单内容 - 可滚动 */
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            {error && (
              <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-fadeIn">
                {error}
              </div>
            )}

            {/* 上传区域 */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={file ? `更换文件：${file.name}` : '选择 HTML 或 ZIP 文件'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`relative p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300
                ${dragActive
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[0.98]'
                  : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {file ? (
                    <svg className="w-12 h-12 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  ) : (
                    <svg className="w-12 h-12 text-[var(--text-secondary)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  )}
                </div>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold truncate px-4">{file.name}</p>
                    <p className="text-sm text-[var(--accent)] font-semibold">点击更换文件</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-lg font-bold">拖拽文件到这里</p>
                    <p className="text-sm text-[var(--text-secondary)] font-medium">支持 .html 或 .zip 格式</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* 项目名称 */}
              <div>
                <label htmlFor="upload-name" className="block text-sm font-bold mb-2 ml-1">项目名称</label>
                <input
                  id="upload-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="作品集展示、简历、演示汇报"
                  className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-primary)] border focus:border-[var(--accent)] outline-none transition-all font-medium"
                />
              </div>

              {/* 项目描述 */}
              <div>
                <label htmlFor="upload-description" className="block text-sm font-bold mb-2 ml-1">项目描述 (可选)</label>
                <textarea
                  id="upload-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="简短描述该项目的内容..."
                  className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-primary)] border focus:border-[var(--accent)] outline-none transition-all font-medium resize-none shadow-sm"
                />
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3.5 rounded-2xl font-bold bg-[var(--bg-tertiary)] hover:bg-[var(--border)] transition-all"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!file || !name.trim()}
                className={`flex-[2] py-3.5 rounded-2xl font-bold transition-all shadow-lg relative overflow-hidden
                  ${!file || !name.trim()
                    ? 'bg-[var(--accent)]/50 cursor-not-allowed text-white/70 shadow-none'
                    : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-blue-500/30'}`}
              >
                确认创建
              </button>
            </div>
          </form>
        ) : stage === 'entry' && createdProject ? (
          <form onSubmit={handleSaveEntry} className="p-6 space-y-6 overflow-y-auto" aria-busy={uploading}>
            <p role="status" className="text-sm text-[var(--text-secondary)]">
              文件已上传，发现多个 HTML 页面。请选择分享时默认打开的页面，保存后完成创建。
            </p>
            {error && <p role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</p>}
            <div>
              <label htmlFor="upload-entry" className="block text-sm font-bold mb-2 ml-1">默认入口</label>
              <select
                id="upload-entry"
                value={entryFile}
                onChange={(e) => setEntryFile(e.target.value)}
                disabled={uploading}
                aria-describedby="upload-entry-path upload-entry-help"
                className="w-full min-w-0 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-[var(--accent)] font-medium"
              >
                {createdProject.entryFiles?.map(path => <option key={path} value={path}>{path}</option>)}
              </select>
              <p id="upload-entry-path" className="mt-2 text-sm break-all">{entryFile}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[var(--text-secondary)]">全部页面（{createdProject.entryFiles?.length}）</summary>
                <ul className="mt-2 space-y-1 list-disc pl-5">
                  {createdProject.entryFiles?.map(path => <li key={path} className="break-all">{path}</li>)}
                </ul>
              </details>
              <p id="upload-entry-help" className="mt-3 text-sm text-[var(--text-secondary)]">项目已保留。现在关闭也可稍后在编辑项目中修改入口，无需再次上传。</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={handleClose} disabled={uploading} className="flex-1 py-3.5 rounded-2xl font-bold bg-[var(--bg-tertiary)] hover:bg-[var(--border)] disabled:opacity-50">保留并关闭</button>
              <button type="submit" disabled={uploading || !entryFile} className="flex-1 py-3.5 rounded-2xl font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50">{uploading ? '保存中...' : '保存并完成'}</button>
            </div>
          </form>
        ) : (
          /* 进度视图 */
          <div role="status" aria-live="polite" className="p-6 flex flex-col items-center justify-center min-h-[280px]">
            {stage === 'complete' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">创建成功</h3>
                <p className="text-sm text-[var(--text-secondary)] font-medium">项目已创建完成</p>
              </>
            ) : (
              <>
                {/* 环形进度条 */}
                <div className="relative w-24 h-24 mb-6">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="var(--border)" strokeWidth="6" fill="none" />
                    <circle
                      cx="50" cy="50" r="42"
                      stroke="var(--accent)"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - (stage === 'processing' ? 1 : uploadProgress) / 100)}`}
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-[var(--accent)]">
                      {stage === 'processing' ? '...' : `${uploadProgress}%`}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-2">
                  {stage === 'processing' ? '正在处理' : '正在上传'}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-medium text-center">
                  {stage === 'processing'
                    ? '文件上传完成，正在解析并创建项目...'
                    : `${name} · 请勿关闭此窗口`}
                </p>

                {/* 步骤指示器 */}
                <div className="flex items-center gap-3 mt-6">
                  <div className={`flex items-center gap-1.5 ${uploadProgress > 0 || stage === 'processing' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      uploadProgress > 0 || stage === 'processing' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)]'
                    }`}>
                      {uploadProgress >= 100 || stage === 'processing' ? '✓' : '1'}
                    </div>
                    <span className="text-xs font-bold">上传</span>
                  </div>
                  <div className={`w-8 h-px ${stage === 'processing' ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                  <div className={`flex items-center gap-1.5 ${stage === 'processing' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      stage === 'processing' ? 'bg-[var(--accent)] text-white animate-pulse' : 'bg-[var(--border)]'
                    }`}>
                      2
                    </div>
                    <span className="text-xs font-bold">处理</span>
                  </div>
                  <div className={`w-8 h-px bg-[var(--border)]`} />
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] opacity-40">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[var(--border)]">
                      3
                    </div>
                    <span className="text-xs font-bold">完成</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}