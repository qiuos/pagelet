import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi, usersApi } from '../api/client';
import type { User, ApiError } from '@pagelet/shared';

type Tab = 'profile' | 'users' | 'security';

// --- 用户管理弹窗组件 ---
function UserModal({ 
  user, 
  onClose, 
  onSaved 
}: { 
  user?: User; 
  onClose: () => void; 
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState<'admin' | 'member'>(user?.role || 'member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit) {
        await usersApi.update(user.id, { username, name, role });
      } else {
        if (!password) throw new Error('请输入初始密码');
        await usersApi.create({ username, password, name, role });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className="relative apple-card w-full max-w-md bg-[var(--bg-secondary)] overflow-hidden shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-[var(--border)] flex justify-between items-center">
           <h2 className="font-black tracking-tight">{isEdit ? '编辑用户信息' : '创建新用户'}</h2>
           <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">用户名</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none" required />
              <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 px-1">登录账号，不可与已有用户名重复</p>
            </div>
            {!isEdit && (
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">初始密码</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none" required minLength={6} />
                <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 px-1">至少 6 个字符，建议包含字母和数字</p>
              </div>
            )}
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">显示名称</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none" required />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">系统角色</label>
              <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border)]">
                {['admin', 'member'].map(r => (
                  <button key={r} type="button" onClick={() => setRole(r as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${role === r ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>{r === 'admin' ? '管理员' : '普通成员'}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 font-black text-xs uppercase bg-[var(--bg-tertiary)] rounded-2xl">取消</button>
            <button type="submit" disabled={loading} className="flex-1 py-4 font-black text-xs uppercase bg-[var(--accent)] text-white rounded-2xl shadow-xl shadow-blue-500/20">{loading ? '处理中...' : (isEdit ? '保存更改' : '立即创建')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 重置密码弹窗 ---
function ResetPasswordModal({ 
  userId, 
  onClose 
}: { 
  userId: string; 
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.resetPassword(userId, newPassword);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch {
      alert('重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className="relative apple-card w-full max-w-sm bg-[var(--bg-secondary)] p-8 text-center shadow-2xl"
      >
        {success ? (
          <div className="py-10 space-y-4">
             <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto shadow-lg"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>
             <p className="font-black text-lg">密码重置成功</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <h3 className="text-xl font-black">强制重置密码</h3>
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase text-left tracking-widest px-1">设置新密码</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入新密码" className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] outline-none font-bold" required minLength={6} />
              <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 text-left px-1">至少 6 个字符，建议包含字母和数字</p>
            </div>
            <div className="flex gap-4">
               <button type="button" onClick={onClose} className="flex-1 py-4 font-black text-xs uppercase bg-[var(--bg-tertiary)] rounded-2xl">取消</button>
               <button type="submit" disabled={loading} className="flex-1 py-4 font-black text-xs uppercase bg-red-500 text-white rounded-2xl shadow-xl shadow-red-500/20">{loading ? '提交中...' : '确认重置'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- 主页面组件 ---
export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // 监听用户数据同步
  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username);
    }
  }, [user]);

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Users Management States
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, isAdmin]);

  const loadUsers = async () => {
    try {
      const response = await usersApi.list();
      if (response.data.success) setUsers(response.data.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await usersApi.update(user!.id, { username, name });
      if (response.data.success) {
        setUser({ ...user!, username, name });
        setSuccess('个人资料更新成功');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) return setError('两次输入的密码不一致');
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      navigate('/login');
    }
  };

  const menuItems = [
    { id: 'profile', label: '个人资料', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'security', label: '安全设置', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> },
    ...(isAdmin ? [{ id: 'users', label: '用户管理', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> }] : []),
  ];

  if (!user) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-50 glass-effect border-b border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
             </button>
             <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gradient">设置</h1>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 rounded-xl border border-red-500/20 text-red-500 font-bold text-xs hover:bg-red-500/10 transition-all font-black uppercase tracking-widest">
             退出系统
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 space-y-2">
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm transition-all ${activeTab === item.id ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </aside>

          <div className="flex-1 min-h-[500px]">
            <div className="apple-card p-6 sm:p-10">
              {activeTab === 'profile' && (
                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg">
                  <h2 className="text-2xl font-black mb-8">个人资料</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">登录用户名</label>
                      <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border-[var(--border)] focus:border-[var(--accent)] border outline-none font-bold transition-all" />
                      <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 px-1">修改后下次登录请使用新用户名</p>
                    </div>
                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">显示名称</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border-[var(--border)] focus:border-[var(--accent)] border outline-none font-bold transition-all" /></div>
                  </div>
                  {success && <p className="text-xs font-bold text-green-500">{success}</p>}{error && <p className="text-xs font-bold text-red-500">{error}</p>}
                  <button type="submit" disabled={loading} className="px-8 py-4 bg-[var(--accent)] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-all shadow-xl shadow-blue-500/20">{loading ? '正在保存...' : '保存更改'}</button>
                </form>
              )}

              {activeTab === 'security' && (
                <form onSubmit={handleChangePassword} className="space-y-6 max-w-lg">
                  <h2 className="text-2xl font-black mb-8">安全设置</h2>
                  <div className="space-y-4">
                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">当前密码</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border-[var(--border)] focus:border-[var(--accent)] border outline-none font-bold transition-all" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">新密码</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border-[var(--border)] focus:border-[var(--accent)] border outline-none font-bold transition-all" />
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 px-1">至少 6 个字符，建议包含字母和数字</p>
                      </div>
                      <div><label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-1">确认新密码</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border-[var(--border)] focus:border-[var(--accent)] border outline-none font-bold transition-all" /></div>
                    </div>
                  </div>
                  {success && <p className="text-xs font-bold text-green-500">{success}</p>}{error && <p className="text-xs font-bold text-red-500">{error}</p>}
                  <button type="submit" disabled={loading} className="px-8 py-4 bg-[var(--accent)] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-all shadow-xl shadow-blue-500/20">{loading ? '正在更新...' : '确认修改'}</button>
                </form>
              )}

              {activeTab === 'users' && isAdmin && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-black">用户管理</h2>
                     <button onClick={() => { setEditingUser(undefined); setShowUserModal(true); }} className="px-5 py-3 bg-[var(--accent)] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20">+ 新增团队成员</button>
                  </div>
                  <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">用户详情</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hidden md:table-cell">权限角色</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-right">管理操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors group">
                             <td className="py-5 px-6">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-black text-xs shadow-inner">{u.name[0].toUpperCase()}</div>
                                   <div><p className="font-black text-sm leading-none mb-1.5">{u.name}</p><p className="text-[10px] text-[var(--text-secondary)] font-medium">@{u.username}</p></div>
                                </div>
                             </td>
                             <td className="py-5 px-6 hidden md:table-cell"><span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-400'}`}>{u.role === 'admin' ? '超级管理员' : '普通用户'}</span></td>
                             <td className="py-5 px-6 text-right">
                                <div className="flex items-center justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white transition-all text-[10px] font-black uppercase">编辑</button>
                                   <button onClick={() => setResetPasswordId(u.id)} className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] hover:bg-orange-500 hover:text-white transition-all text-[10px] font-black uppercase">重置</button>
                                   {u.id !== user.id && <button onClick={async () => { if(confirm(`确定删除用户 ${u.name} 吗？`)) { await usersApi.delete(u.id); loadUsers(); } }} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase">删除</button>}
                                </div>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

        {showUserModal && <UserModal user={editingUser} onClose={() => { setShowUserModal(false); setEditingUser(undefined); }} onSaved={loadUsers} />}
        {resetPasswordId && <ResetPasswordModal userId={resetPasswordId} onClose={() => setResetPasswordId(null)} />}
    </div>
  );
}