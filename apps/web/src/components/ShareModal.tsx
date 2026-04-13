import { useState } from 'react';
import { format, addHours, addDays, addWeeks, addMonths } from 'date-fns';
import DatePicker, { registerLocale } from 'react-datepicker';
import { zhCN } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { useThemeStore } from '../stores/themeStore';
import { sharesApi } from '../api/client';
import type { ApiError } from '@pagelet/shared';

// 注册中文语言
registerLocale('zh-CN', zhCN);

interface ShareModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

const PRESETS = [
  { label: '永久', value: 'never' },
  { label: '1 小时', value: '1h' },
  { label: '1 天', value: '1d' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '自定义', value: 'custom' },
];

export default function ShareModal({ projectId, onClose, onCreated }: ShareModalProps) {
  const { theme } = useThemeStore();
  const [password, setPassword] = useState('');
  const [preset, setPreset] = useState('never');
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [maxViews, setMaxViews] = useState('');
  const [isOneTime, setIsOneTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const getExpiryDate = (): Date | null => {
    if (preset === 'never') return null;
    if (preset === 'custom') return customDate;

    const now = new Date();
    switch (preset) {
      case '1h': return addHours(now, 1);
      case '1d': return addDays(now, 1);
      case '7d': return addWeeks(now, 1);
      case '30d': return addMonths(now, 1);
      default: return null;
    }
  };

  const getExpiryPreview = () => {
    const date = getExpiryDate();
    if (!date) return '永久有效';
    return format(date, 'yyyy-MM-dd HH:mm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const expiresAt = getExpiryDate();
      const response = await sharesApi.create({
        projectId,
        password: password || undefined,
        expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
        maxViews: maxViews ? parseInt(maxViews) : undefined,
        isOneTime: isOneTime || undefined
      });

      if (response.data.success) {
        const url = `${window.location.origin}/s/${response.data.data.slug}`;
        setCreatedUrl(url);
        onCreated();
      }
    } catch (err) {
      const apiError = err as { response?: { data?: ApiError } };
      setError(apiError.response?.data?.error?.message || '创建分享链接失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="apple-card w-full max-w-md overflow-hidden bg-[var(--bg-secondary)]/90 backdrop-blur-md border-[var(--border)]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-xl font-black tracking-tight">发布公开分享</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8">
          {createdUrl ? (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-green-500/20">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black mb-2">链接已生成</h3>
                <p className="text-[var(--text-secondary)] font-medium">您可以将此链接发送给任何人访问</p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">点击即可复制</p>
                <button
                  onClick={handleCopy}
                  className="w-full text-left px-4 py-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] group hover:border-[var(--accent)] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm truncate mr-4 text-[var(--accent)]">{createdUrl}</span>
                    <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                      {copied ? '已复制' : '复制'}
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setCreatedUrl('')}
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[var(--bg-tertiary)] hover:bg-[var(--border)] transition-all"
                >
                  再次创建
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] shadow-xl transition-all"
                >
                  完成
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
                  {error}
                </div>
              )}

              {/* 安全密钥 */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
	                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">安全密钥 (可选)</label>
	                  <span className="text-[10px] text-[var(--text-secondary)]">至少 4 位，不设置则公开访问</span>
	                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="设置访问密码"
                  className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-tertiary)] border-transparent focus:bg-[var(--bg-primary)] border focus:border-[var(--accent)] outline-none transition-all font-bold placeholder:font-medium"
                />
              </div>

              {/* 链接有效期 */}
              <div>
                <div className="flex items-center justify-between px-1 mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">链接有效期</label>
                  <span className="text-[10px] font-black text-[var(--accent)]">
                    {preset === 'never' ? '永久有效' : `将于 ${getExpiryPreview()} 失效`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPreset(p.value)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        preset === p.value
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-blue-500/20'
                        : 'bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {preset === 'custom' && (
                    <div className="overflow-hidden">
                      <div className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">选择过期时间</label>
                        <DatePicker
                          selected={customDate}
                          onChange={(date: Date | null) => {
                            setCustomDate(date);
                            setPreset('custom');
                          }}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="yyyy-MM-dd HH:mm"
                          locale="zh-CN"
                          placeholderText="点击选择日期时间"
                          minDate={new Date()}
                          className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none focus:border-[var(--accent)] transition-all text-sm font-medium cursor-pointer
                            ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                          wrapperClassName="w-full"
                          popperClassName="date-picker-popper"
                        />
                      </div>
                    </div>
                  )}
              </div>

              {/* 一次性访问 */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold">一次性访问</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">访问一次后链接立即失效</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOneTime(!isOneTime)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isOneTime ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isOneTime ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* 访问次数上限 */}
              <div className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">访问次数上限</label>
                  <span className="text-[10px] text-[var(--text-secondary)]">不填则无限制</span>
                </div>
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  placeholder="例如: 100"
                  min="1"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none focus:border-[var(--accent)] transition-all text-sm font-medium"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[var(--bg-tertiary)] hover:bg-[var(--border)] transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading || (preset === 'custom' && !customDate)}
                  className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl
                    ${loading || (preset === 'custom' && !customDate)
                      ? 'bg-[var(--accent)]/50 cursor-not-allowed shadow-none'
                      : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-blue-500/20 hover:-translate-y-0.5'}`}
                >
                  {loading ? '正在配置...' : '确认发布'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* DatePicker 样式覆盖 */}
      <style>{`
        .react-datepicker {
          font-family: inherit;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg-secondary);
        }
        .react-datepicker__header {
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
        }
        .react-datepicker__current-month,
        .react-datepicker__day-name {
          color: var(--text-primary);
        }
        .react-datepicker__day {
          color: var(--text-secondary);
          border-radius: 8px;
        }
        .react-datepicker__day:hover,
        .react-datepicker__day--selected {
          background: var(--accent) !important;
          color: white !important;
        }
        .react-datepicker__day--disabled {
          color: var(--text-secondary);
          opacity: 0.4;
        }
        .react-datepicker__time-list-item {
          color: var(--text-secondary);
        }
        .react-datepicker__time-list-item:hover {
          background: var(--bg-tertiary) !important;
        }
        .react-datepicker__time-list-item--selected {
          background: var(--accent) !important;
          color: white !important;
        }
        .react-datepicker__navigation-icon::before {
          border-color: var(--text-secondary);
        }
        .react-datepicker__time-container {
          border-left: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}