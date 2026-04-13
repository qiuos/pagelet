import { useRef } from 'react';
import { useThemeStore } from '../stores/themeStore';

interface ThumbnailManagerProps {
  thumbnail?: string;
  projectId?: string;
  onRegenerate?: () => Promise<void>;
  onUpload: (formData: FormData) => Promise<void>;
  mode: 'create' | 'edit';
}

export default function ThumbnailManager({ thumbnail, projectId, onRegenerate, onUpload, mode }: ThumbnailManagerProps) {
  const { theme } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData();
      formData.append('thumbnail', e.target.files[0]);

      try {
        await onUpload(formData);
      } catch (err) {
        console.error('Upload thumbnail failed:', err);
      }
    }
  };

  const handleRegenerate = async () => {
    if (onRegenerate) {
      try {
        await onRegenerate();
      } catch (err) {
        console.error('Regenerate thumbnail failed:', err);
      }
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
        className={`aspect-[4/3] overflow-hidden rounded-lg border-2 border-dashed cursor-pointer transition-all
          ${theme === 'dark'
            ? 'border-dark-border bg-dark-bg-tertiary hover:border-accent'
            : 'border-light-border bg-light-bg-tertiary hover:border-accent'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="封面"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-4xl opacity-50">🖼️</span>
            <p className={`mt-2 text-sm
              ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-light-text-secondary'}`}>
              点击上传封面图
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors
            ${theme === 'dark'
              ? 'bg-dark-bg-tertiary text-dark-text-primary hover:bg-dark-bg-primary'
              : 'bg-light-bg-tertiary text-light-text-primary hover:bg-light-bg-primary'}`}
        >
          上传封面
        </button>

        {mode === 'edit' && projectId && onRegenerate && (
          <button
            type="button"
            onClick={handleRegenerate}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors
              ${theme === 'dark'
                ? 'bg-dark-bg-tertiary text-dark-text-primary hover:bg-dark-bg-primary'
                : 'bg-light-bg-tertiary text-light-text-primary hover:bg-light-bg-primary'}`}
          >
            从 HTML 重新生成
          </button>
        )}
      </div>

      {mode === 'create' && (
        <p className={`text-xs
          ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-light-text-secondary'}`}>
          创建项目后将自动从 HTML 页面生成封面图
        </p>
      )}
    </div>
  );
}