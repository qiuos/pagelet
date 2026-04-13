import { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { projectsApi } from '../api/client';
import type { ApiError } from '@pagelet/shared';

interface ThumbnailEditorProps {
  projectId: string;
  thumbnail?: string;
  onThumbnailUpdate: (thumbnail: string) => void;
}

export default function ThumbnailEditor({ projectId, thumbnail, onThumbnailUpdate }: ThumbnailEditorProps) {
  const { theme } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData();
      formData.append('thumbnail', e.target.files[0]);

      try {
        setUploading(true);
        const response = await projectsApi.uploadThumbnail(projectId, formData);
        if (response.data.success) {
          onThumbnailUpdate(response.data.data.thumbnail);
        }
      } catch (err) {
        console.error('Upload thumbnail failed:', err);
        alert('上传封面失败');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const response = await projectsApi.regenerateThumbnail(projectId);
      if (response.data.success) {
        onThumbnailUpdate(response.data.data.thumbnail);
      }
    } catch (err) {
      console.error('Regenerate thumbnail failed:', err);
      alert('生成封面失败');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className={`block text-sm font-medium
        ${theme === 'dark' ? 'text-dark-text-primary' : 'text-light-text-primary'}`}>
        封面图
      </label>

      {/* 封面预览 */}
      <div
        className="aspect-[4/3] overflow-hidden rounded-lg border cursor-pointer transition-all relative group"
        onClick={() => fileInputRef.current?.click()}
      >
        {thumbnail ? (
          <>
            <img
              src={thumbnail}
              alt="封面"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm">点击更换封面</span>
            </div>
          </>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center
            ${theme === 'dark' ? 'bg-dark-bg-tertiary' : 'bg-light-bg-tertiary'}`}>
            <span className="text-4xl opacity-50">🖼️</span>
            <p className={`mt-2 text-sm
              ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-light-text-secondary'}`}>
              点击上传封面图
            </p>
          </div>
        )}
        {(uploading || regenerating) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading || regenerating}
      />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || regenerating}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-50
            ${theme === 'dark'
              ? 'bg-dark-bg-tertiary text-dark-text-primary hover:bg-dark-bg-primary'
              : 'bg-light-bg-tertiary text-light-text-primary hover:bg-light-bg-primary'}`}
        >
          {uploading ? '上传中...' : '上传封面'}
        </button>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={uploading || regenerating}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-50
            ${theme === 'dark'
              ? 'bg-dark-bg-tertiary text-dark-text-primary hover:bg-dark-bg-primary'
              : 'bg-light-bg-tertiary text-light-text-primary hover:bg-light-bg-primary'}`}
        >
          {regenerating ? '生成中...' : '从 HTML 生成'}
        </button>
      </div>
    </div>
  );
}