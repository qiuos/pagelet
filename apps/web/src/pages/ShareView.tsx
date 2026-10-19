import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { publicApi } from '../api/client';
import type { Share } from '@pagelet/shared';
import ShareNavigation from './ShareNavigation';
import { htmlPages, pageUrl } from './sharePageTree';
import type { ApiError } from '@pagelet/shared';

interface ShareInfo {
  share: Share;
  project: {
    id: string;
    name: string;
    description?: string;
    entryFile?: string;
    entryFiles?: string[];
  };
  creatorName: string;
  needsPassword: boolean;
}

export default function ShareView() {
  const { slug } = useParams<{ slug: string }>();
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (slug) {
      loadShareInfo();
    }
  }, [slug]);

  const loadShareInfo = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError('');
      const response = await publicApi.getShare(slug);
      if (response.data.success) {
        setShareInfo(response.data.data);
      } else {
        setError('分享链接不存在或已失效');
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '分享链接不存在或已失效');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !password) return;

    setVerifying(true);
    setPasswordError('');

    try {
      const response = await publicApi.verifyPassword(slug, password);
      if (response.data.success) {
        await loadShareInfo();
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setPasswordError(apiError.response?.data?.error?.message || '密码错误');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg-primary">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg-primary">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-dark-text-primary mb-2">链接无效</h1>
          <p className="text-dark-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!shareInfo) {
    return null;
  }

  const { share, project, creatorName } = shareInfo;

  // 需要密码但未验证
  if (shareInfo.needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-bg-primary to-dark-bg-secondary">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-md p-8 rounded-xl
            bg-dark-bg-secondary border border-dark-border shadow-lg`}
        >
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-dark-text-primary">Pagelet</h1>
            <p className="text-dark-text-secondary mt-1">
              由 <span className="text-accent">{creatorName || '未知用户'}</span> 分享
            </p>
          </div>

          {/* 项目名称 */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-dark-text-primary">
              {project.name}
            </h2>
            {project.description && (
              <p className="text-dark-text-secondary mt-1 text-sm">
                {project.description}
              </p>
            )}
          </div>

          {/* 密码表单 */}
          <form onSubmit={handleVerifyPassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20">
                <p className="text-sm text-error">{passwordError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-dark-text-primary mb-1.5">
                🔒 请输入访问密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码..."
                className="w-full px-4 py-2.5 rounded-lg outline-none transition-colors
                  bg-dark-bg-tertiary text-dark-text-primary border border-dark-border
                  focus:border-accent"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={verifying || !password}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors
                ${verifying || !password
                  ? 'bg-accent/50 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover'}
                text-white`}
            >
              {verifying ? '验证中...' : '确认访问'}
            </button>
          </form>

          {/* 过期信息 */}
          {share.expiresAt && (
            <p className="text-center mt-4 text-sm text-dark-text-secondary">
              此链接将在 {new Date(share.expiresAt).toLocaleString('zh-CN')} 过期
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  const pages = htmlPages(project.entryFiles);
  if (pages.length > 1) {
    return <ShareNavigation key={`${slug}:${project.id}`} slug={slug!} name={project.name} pages={pages} entryFile={project.entryFile} />;
  }

  // 单页或旧版元数据保持全屏预览。
  return (
    <iframe
      src={pageUrl(slug!)}
      className="fixed inset-0 w-full h-full border-0"
      title={project.name}
    />
  );
}