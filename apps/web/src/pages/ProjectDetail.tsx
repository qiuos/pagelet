import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { projectsApi, sharesApi } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import type { Project, Share, ApiError } from '@pagelet/shared';
import ShareModal from '../components/ShareModal';

interface ProjectWithShares extends Project {
  shares: Share[];
  shareCount: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [project, setProject] = useState<ProjectWithShares | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      const response = await projectsApi.get(id!);
      if (response.data.success) {
        setProject(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('加载项目失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleArchive = async () => {
    if (!project) return;
    try {
      const newStatus = project.status === 'active' ? 'archived' : 'active';
      await projectsApi.update(project.id, { status: newStatus });
      setProject({ ...project, status: newStatus });
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!project) return;
    try {
      await projectsApi.delete(project.id);
      navigate('/dashboard');
    } catch (err) {
      alert('删除失败');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm('确定要删除此分享链接吗？')) return;
    try {
      await sharesApi.delete(shareId);
      loadProject();
    } catch (err) {
      alert('删除分享失败');
    }
  };

  const handleCopyLink = async (share: Share) => {
    const url = `${window.location.origin}/s/${share.slug}`;
    const lines = [project?.name || '项目', url];
    if (share.hasPassword && share.password) {
      lines.push(`访问密码: ${share.password}`);
    }
    if (share.expiresAt) {
      lines.push(`有效期至: ${new Date(share.expiresAt).toLocaleString()}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !project) return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="apple-card p-12 text-center max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-4">{error || '项目不存在'}</h2>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl">返回项目列表</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-50 glass-effect border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gradient">项目详情</h1>
          </div>

          <div className="flex items-center gap-3">
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
      </header>

      <main className="relative z-10 max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <div className="apple-card overflow-hidden flex flex-col md:flex-row shadow-2xl mb-12">
          {/* 左侧：封面 & 元数据 (移动端排列在顶部) */}
          <div className="w-full md:w-[340px] p-6 sm:p-8 space-y-8 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border)]">
             <div className="poster-cover w-full shadow-2xl shadow-black/30 bg-black/5">
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-tertiary)] gap-2">
                     <svg className="w-12 h-12 text-[var(--accent)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                )}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-1 gap-6 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">创建日期</p>
                  <p className="font-bold text-sm tracking-tight">{new Date(project.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">最后更新</p>
                  <p className="font-bold text-sm tracking-tight">{new Date(project.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1 border-t border-[var(--border)] pt-6">
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">分享统计</p>
                  <p className="font-bold text-sm tracking-tight text-[var(--accent)]">{(project.shareCount || 0)} 条已发布链接</p>
                </div>
             </div>
          </div>

          {/* 右侧：标题 & 操作 */}
          <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
             <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-lg bg-[var(--accent)] text-white text-[10px] font-black uppercase tracking-widest leading-none">
                  {project.fileType}
                </span>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest leading-none ${project.status === 'active' ? 'bg-blue-500/10 text-[var(--accent)]' : 'bg-orange-500/10 text-orange-500'}`}>
                   <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-[var(--accent)]' : 'bg-orange-500'}`} />
                   {project.status === 'active' ? '活跃' : '已归档'}
                </div>
             </div>

             <h1 className="text-3xl sm:text-5xl font-black mb-6 tracking-tight leading-tight">{project.name}</h1>
             <p className="text-[var(--text-secondary)] text-base sm:text-lg font-medium leading-relaxed mb-10 max-w-md">
                {project.description || '这就是您创建的精彩项目，暂未添加详细描述。您可以点击编辑按钮补充更多信息。'}
             </p>

             <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex-1 py-5 px-8 bg-[var(--accent)] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 group"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  发布公开分享
                </button>
                <div className="flex gap-4">
                  <button
                    onClick={() => navigate(`/projects/${id}/edit`)}
                    className="flex-1 sm:flex-none aspect-square p-5 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-all flex items-center justify-center group"
                    title="编辑项目"
                  >
                    <svg className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={handleArchive}
                    className="flex-1 sm:flex-none aspect-square p-5 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-all flex items-center justify-center group"
                    title={project.status === 'active' ? '归档' : '恢复激活'}
                  >
                    <svg className={`w-6 h-6 ${project.status === 'active' ? 'text-[var(--text-secondary)]' : 'text-orange-500'} group-hover:text-[var(--accent)] transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 sm:flex-none aspect-square p-5 rounded-2xl border border-[var(--border)] bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center group"
                    title="删除项目"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
             </div>
          </div>
        </div>

        {/* 分享管理区 */}
        <div className="space-y-8">
           <div className="flex items-center justify-between px-2">
             <h3 className="text-2xl font-black tracking-tight">管理分享链接</h3>
             <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-3 py-1 bg-[var(--bg-tertiary)] rounded-full border border-[var(--border)]">{((project as ProjectWithShares).shares?.length || 0)} 个活跃链接</span>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {((project as ProjectWithShares).shares?.length || 0) === 0 ? (
               <div className="col-span-2 py-24 bg-[var(--bg-secondary)] rounded-3xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center opacity-60">
                  <svg className="w-12 h-12 mb-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <p className="font-bold text-sm">还没有人为该项目发布过任何分享链接</p>
               </div>
             ) : (
               (project as ProjectWithShares).shares?.map((share: Share) => (
                 <motion.div 
                   key={share.id} 
                   layout
                   className="apple-card p-6 flex flex-col gap-6 group hover:-translate-y-1 transition-all"
                 >
                   <div className="flex justify-between items-start">
                      <div className="space-y-1.5 overflow-hidden">
                         <div className="flex items-center gap-2">
                            <code className="text-[12px] font-black text-[var(--accent)] tracking-tighter truncate">/s/{share.slug}</code>
                            {share.isOneTime && <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-md ring-1 ring-inset ring-orange-500/20">阅后即焚</span>}
                            {share.hasPassword && <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-md ring-1 ring-inset ring-purple-500/20">加密</span>}
                         </div>
                         <div className="flex flex-col gap-0.5">
                            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest truncate">链接标识码</p>
                            {share.expiresAt && <p className="text-[9px] font-black text-red-500 uppercase tracking-tight">有效期至 {new Date(share.expiresAt).toLocaleDateString()}</p>}
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="inline-flex items-end gap-1">
                            <span className="text-3xl font-black tabular-nums leading-none tracking-tighter">{share.viewCount}</span>
                         </div>
                         <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest mt-1">累计访问</p>
                      </div>
                   </div>

                   <div className="flex gap-2">
                      <a
                        href={`${window.location.origin}/s/${share.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest text-center"
                      >
                        预览
                      </a>
                      <button 
                        onClick={() => handleCopyLink(share)}
                        className="flex-[2] py-3 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white transition-all font-black text-[10px] uppercase tracking-widest text-center"
                      >
                        {copiedId === share.id ? '复制成功 ✓' : '复制分享'}
                      </button>
                      <button 
                        onClick={() => handleDeleteShare(share.id)}
                        className="px-3 rounded-xl border border-[var(--border)] hover:bg-red-500 hover:text-white transition-all group/del"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                   </div>
                 </motion.div>
               ))
             )}
           </div>
        </div>
      </main>

      {showShareModal && (
        <ShareModal
          projectId={id!}
          onClose={() => setShowShareModal(false)}
          onCreated={() => {
            setShowShareModal(false);
            loadProject();
          }}
        />
      )}

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-primary)] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">确认删除</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-6">确定要删除此项目吗？此操作不可撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-all font-bold text-sm"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all font-bold text-sm"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}