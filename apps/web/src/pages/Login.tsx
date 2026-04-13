import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/client';
import { ApiError } from '@pagelet/shared';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      if (response.data.success) {
        const { token, user } = response.data.data;
        setToken(token);
        setUser(user);
        navigate('/dashboard');
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--bg-primary)]">
      {/* 动态背景装点 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="apple-card p-10 shadow-2xl bg-[var(--bg-secondary)]/80 backdrop-blur-md">
          {/* Logo & Intro */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-gradient mb-3">
              Pagelet
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              极致简约的静态资源托管平台
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 ml-1 text-[var(--text-secondary)]">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-primary)] border focus:border-[var(--accent)] outline-none transition-all font-medium"
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 ml-1 text-[var(--text-secondary)]">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-primary)] border focus:border-[var(--accent)] outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl
                ${loading
                  ? 'bg-[var(--accent)]/50 cursor-not-allowed shadow-none'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-blue-500/20 hover:-translate-y-0.5'}`}
            >
              {loading ? '正在验证...' : '进入系统'}
            </button>

          </form>
        </div>
      </motion.div>
    </div>
  );
}
