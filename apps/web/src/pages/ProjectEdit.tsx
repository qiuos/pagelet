import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useThemeStore } from '../stores/themeStore';
import { projectsApi } from '../api/client';
import type { Project } from '@pagelet/shared';
import type { ApiError } from '@pagelet/shared';
import ThumbnailEditor from '../components/ThumbnailEditor';

export default function ProjectEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  const [project, setProject] = useState<Project | null>(null);
  const [thumbnail, setThumbnail] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await projectsApi.get(id);
      if (response.data.success) {
        setProject(response.data.data);
        setName(response.data.data.name);
        setDescription(response.data.data.description || '');
        setThumbnail(response.data.data.thumbnail || '');
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('加载项目失败');
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailUpdate = (newThumbnail: string) => {
    setThumbnail(newThumbnail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name.trim()) return;

    try {
      setSaving(true);
      setError('');
      const response = await projectsApi.update(id, {
        name: name.trim(),
        description: description.trim() || undefined
      });
      if (response.data.success) {
        navigate(`/projects/${id}`);
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center
        ${theme === 'dark' ? 'bg-dark-bg-primary' : 'bg-light-bg-primary'}`}>
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark-bg-primary' : 'bg-light-bg-primary'}`}>
      {/* 顶部导航 */}
      <header className={`sticky top-0 z-10 border-b
        ${theme === 'dark' ? 'bg-dark-bg-secondary border-dark-border' : 'bg-light-bg-secondary border-light-border'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/projects/${id}`)}
              className={`flex items-center gap-2 transition-colors
                ${theme === 'dark' ? 'text-dark-text-secondary hover:text-dark-text-primary' : 'text-light-text-secondary hover:text-light-text-primary'}`}
            >
              <span>←</span>
              <span>返回</span>
            </button>
            <h1 className={`text-xl font-bold
              ${theme === 'dark' ? 'text-dark-text-primary' : 'text-light-text-primary'}`}>
              编辑项目
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20"
          >
            <p className="text-sm text-error">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 封面编辑 */}
          {project && (
            <div className={`p-6 rounded-xl border
              ${theme === 'dark'
                ? 'bg-dark-bg-secondary border-dark-border'
                : 'bg-light-bg-secondary border-light-border'}`}>
              <ThumbnailEditor
                projectId={project.id}
                thumbnail={thumbnail}
                onThumbnailUpdate={handleThumbnailUpdate}
              />
            </div>
          )}

          {/* 基本信息 */}
          <div className={`p-6 rounded-xl border
            ${theme === 'dark'
              ? 'bg-dark-bg-secondary border-dark-border'
              : 'bg-light-bg-secondary border-light-border'}`}>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2
                  ${theme === 'dark' ? 'text-dark-text-primary' : 'text-light-text-primary'}`}>
                  项目名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={`w-full px-4 py-2.5 rounded-lg outline-none transition-colors
                    ${theme === 'dark'
                      ? 'bg-dark-bg-tertiary text-dark-text-primary border border-dark-border focus:border-accent'
                      : 'bg-light-bg-tertiary text-light-text-primary border border-light-border focus:border-accent'}`}
                  placeholder="输入项目名称"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2
                  ${theme === 'dark' ? 'text-dark-text-primary' : 'text-light-text-primary'}`}>
                  项目描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={`w-full px-4 py-2.5 rounded-lg outline-none transition-colors resize-none
                    ${theme === 'dark'
                      ? 'bg-dark-bg-tertiary text-dark-text-primary border border-dark-border focus:border-accent'
                      : 'bg-light-bg-tertiary text-light-text-primary border border-light-border focus:border-accent'}`}
                  placeholder="输入项目描述（可选）"
                />
              </div>

              {project && (
                <div className={`text-sm
                  ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-light-text-secondary'}`}>
                  <p>文件类型: {project.fileType.toUpperCase()}</p>
                  <p>创建于: {new Date(project.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors
                ${saving || !name.trim()
                  ? 'bg-accent/50 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover'}
                text-white`}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/projects/${id}`)}
              className={`px-6 py-2.5 rounded-lg transition-colors
                ${theme === 'dark'
                  ? 'bg-dark-bg-tertiary text-dark-text-primary hover:bg-dark-bg-primary'
                  : 'bg-light-bg-tertiary text-light-text-primary hover:bg-light-bg-primary'}`}
            >
              取消
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}