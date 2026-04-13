import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { projectsApi, authApi } from '../api/client';
import type { Project } from '@pagelet/shared';
import UploadModal from '../components/UploadModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, setLoading: setAuthLoading, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await projectsApi.list();
      if (response.data.success) {
        setProjects(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('加载项目失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = useAuthStore.getState().token;
      if (token) {
        try {
          const response = await authApi.me();
          if (response.data.success) {
            setUser(response.data.data);
          }
          loadProjects();
        } catch {
          logout();
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [navigate, loadProjects, setUser, logout, setAuthLoading]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除此项目吗？')) return;
    try {
      await projectsApi.delete(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      setError('删除失败');
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 顶部导航 - Apple Glass Effect */}
      <header className="sticky top-0 z-50 glass-effect border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8">
            <h1
              className="text-xl sm:text-2xl font-black tracking-tighter cursor-pointer text-gradient"
              onClick={() => navigate('/dashboard')}
            >
              Pagelet
            </h1>

            <nav className="hidden md:flex items-center gap-1">
              {['all', 'active', 'archived'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f as any)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                    statusFilter === f
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/20'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {f === 'all' ? '全部' : f === 'active' ? '活跃' : '归档'}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
            {/* 移动端搜索输入框 */}
            <div className="relative group flex-1 max-w-[140px] md:hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-secondary)] border focus:border-[var(--accent)] outline-none transition-all text-sm font-medium"
              />
            </div>

            {/* 桌面端搜索输入框 */}
            <div className="relative group hidden sm:block max-w-[300px] w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目..."
                className="w-full px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-secondary)] border focus:border-[var(--accent)] outline-none transition-all text-sm font-medium"
              />
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 16.243l.707.707M7.757 7.757l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
              )}
            </button>

            {/* 移动端创建按钮（图标） */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="sm:hidden p-2 rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-blue-500/20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>

            {/* 桌面端创建按钮（文字） */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="hidden sm:block px-6 py-2 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] shadow-lg shadow-blue-500/20 transition-all font-bold text-sm"
            >
              创建项目
            </button>

            <div
              className="flex items-center gap-3 pl-4 border-l border-[var(--border)] cursor-pointer group"
              onClick={() => navigate('/settings')}
            >
              <div className="flex flex-col items-end hidden sm:flex">
                 <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 group-hover:text-[var(--accent)] transition-colors">当前账户</span>
                 <span className="text-sm font-bold group-hover:text-[var(--accent)] transition-colors">{user?.name}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-inner group-hover:scale-105 transition-transform">
                {user?.name?.slice(0, 1).toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>

        {/* 移动端状态筛选 */}
        <div className="md:hidden border-t border-[var(--border)] px-4 py-2 flex items-center gap-1">
          {['all', 'active', 'archived'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                statusFilter === f
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/20'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {f === 'all' ? '全部' : f === 'active' ? '活跃' : '归档'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-10">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">我的库</h2>
            <p className="text-[var(--text-secondary)]">
              共 {filteredProjects.length} 个项目
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-secondary)] font-medium">加载中...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-32 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border)]">
            <div className="flex justify-center mb-6">
              <svg className="w-16 h-16 text-[var(--text-secondary)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">库中尚无项目</h3>
            <p className="text-[var(--text-secondary)] mb-8">开始创建你的第一个静态网页项目吧</p>
            {statusFilter === 'all' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-8 py-3 bg-[var(--accent)] text-white rounded-2xl hover:bg-[var(--accent-hover)] transition-all font-bold"
              >
                立即上传项目
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            <AnimatePresence>
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="poster-cover">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex flex-col items-center justify-center p-4 gap-2">
                        <div className="w-6 h-6 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin opacity-30" />
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-40 font-medium">封面生成中</span>
                      </div>
                    )}
                    
                    {/* 信息悬停层 */}
                    <div className="poster-overlay flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-black bg-white/20 text-white px-2 py-1 rounded-md backdrop-blur-md">
                          {project.fileType}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-base leading-tight drop-shadow-md mb-1">
                        {project.name}
                      </h3>
                      <p className="text-[10px] text-white/70 font-medium">
                         {new Date(project.updatedAt).toLocaleDateString()} 更新
                      </p>
                      
                      <button
                        onClick={(e) => handleDelete(e, project.id)}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-red-500/80 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => loadProjects()}
        />
      )}
    </div>
  );
}