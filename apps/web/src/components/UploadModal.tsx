import { useState, useRef } from 'react';
import { projectsApi } from '../api/client';
import type { ApiError } from '@pagelet/shared';

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file || !name.trim()) {
      setError('请选择文件并填写项目名称');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

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
            setUploadProgress(Math.round((e.loaded * 100) / e.total));
          }
        }
      });
      if (response.data.success) {
        onUploaded();
        onClose();
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="apple-card w-full max-w-lg overflow-hidden border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold tracking-tight">创建新项目</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-fadeIn">
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
              <label className="block text-sm font-bold mb-2 ml-1">项目名称</label>
              <input
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
              <label className="block text-sm font-bold mb-2 ml-1">项目描述 (可选)</label>
              <textarea
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
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-3.5 rounded-2xl font-bold bg-[var(--bg-tertiary)] hover:bg-[var(--border)] transition-all disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !name.trim()}
              className={`flex-[2] py-3.5 rounded-2xl font-bold transition-all shadow-lg relative overflow-hidden
                ${uploading || !file || !name.trim()
                  ? 'bg-[var(--accent)]/50 cursor-not-allowed text-white/70 shadow-none'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-blue-500/30'}`}
            >
              {uploading && (
                <div className="absolute inset-0 bg-[var(--accent)]/30 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              )}
              <span className="relative">
                {uploading ? (uploadProgress < 100 ? `上传中 ${uploadProgress}%` : '正在处理...') : '确认创建'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}