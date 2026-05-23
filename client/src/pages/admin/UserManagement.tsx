import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Search, Ban, ShieldCheck, KeyRound, Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface AdminUser {
  id: number; username: string; email: string; full_name: string;
  avatar_url: string; is_admin: boolean; is_verified: boolean;
  is_banned: boolean; created_at: string; posts_count: number; followers_count: number;
}

interface UserActivity {
  user: any; recentPosts: any[]; recentComments: any[];
  stats: any; devices: any[];
}

// Custom confirm dialog
function ConfirmDialog({ isOpen, title, message, confirmLabel, danger, onConfirm, onCancel }: {
  isOpen: boolean; title: string; message: string; confirmLabel: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-6 max-w-sm w-full mx-4 shadow-card-glow"
        onClick={e => e.stopPropagation()}
      >
        <h3 className={`text-lg font-bold mb-2 ${danger ? 'text-red-400' : 'text-white'}`}>{title}</h3>
        <p className="text-sm text-gray-400 mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/[0.04] transition text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              danger ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30' : ''
            }`}
            style={!danger ? { background: 'linear-gradient(135deg, #00FFD1, #00d4ff)', color: 'var(--color-surface-dark)' } : undefined}
          >{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activityData, setActivityData] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; danger?: boolean; action: () => void } | null>(null);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try { const data = await api.getAdminUsers(); setUsers(data); }
    catch { toast.error('Failed to load users'); }
    finally { setIsLoading(false); }
  };

  const handleBan = (userId: number, username: string) => {
    setConfirm({
      title: `Ban ${username}?`,
      message: 'This user will be unable to log in or use the platform.',
      label: 'Ban User',
      danger: true,
      action: async () => {
        setConfirm(null);
        try {
          await api.banUser(userId);
          setUsers(users.map(u => u.id === userId ? { ...u, is_banned: true } : u));
          toast.success(`${username} has been banned`);
        } catch (e: any) { toast.error(e.message || 'Failed'); }
      }
    });
  };

  const handleUnban = (userId: number, username: string) => {
    setConfirm({
      title: `Unban ${username}?`,
      message: 'This user will regain access to the platform.',
      label: 'Unban User',
      action: async () => {
        setConfirm(null);
        try {
          await api.unbanUser(userId);
          setUsers(users.map(u => u.id === userId ? { ...u, is_banned: false } : u));
          toast.success(`${username} has been unbanned`);
        } catch { toast.error('Failed'); }
      }
    });
  };

  const handleForceReset = (userId: number, username: string) => {
    setConfirm({
      title: `Force Password Reset?`,
      message: `${username} will be required to reset their password on next login.`,
      label: 'Force Reset',
      danger: true,
      action: async () => {
        setConfirm(null);
        try {
          await api.forcePasswordReset(userId);
          toast.success(`${username} must reset password on next login`);
        } catch (e: any) { toast.error(e.message || 'Failed'); }
      }
    });
  };

  const handleViewActivity = async (userId: number) => {
    setActivityLoading(true);
    try { const data = await api.getUserActivity(userId); setActivityData(data); }
    catch { toast.error('Failed to load activity'); }
    finally { setActivityLoading(false); }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Users</h1>
        <p className="text-xs text-gray-500 mt-1">{users.length} registered users</p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by username, email, or name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full skeleton" /><div className="flex-1 space-y-1.5"><div className="h-3 w-32 skeleton rounded" /><div className="h-2 w-48 skeleton rounded" /></div>
            </div>
          ))}
        </div>
      )}

      {/* User List */}
      {!isLoading && (
        <div className="space-y-2">
          {filteredUsers.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar src={user.avatar_url} alt={user.username} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">{user.username}</span>
                    {user.is_admin && (
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-purple-500/15 text-purple-400 border border-purple-500/20 rounded-full">Admin</span>
                    )}
                    {user.is_banned && (
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-red-500/15 text-red-400 border border-red-500/20 rounded-full">Banned</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {user.email} · {user.posts_count} posts · {user.followers_count} followers · Joined {formatDate(user.created_at)}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap">
                  <button onClick={() => handleViewActivity(user.id)} title="View Activity"
                    className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-neon-cyan hover:bg-neon-cyan/[0.06] transition">
                    <Activity size={14} />
                  </button>
                  {!user.is_admin && (
                    <>
                      <button onClick={() => handleForceReset(user.id, user.username)} title="Force Password Reset"
                        className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-amber-400 hover:bg-amber-500/[0.06] transition">
                        <KeyRound size={14} />
                      </button>
                      {!user.is_banned ? (
                        <button onClick={() => handleBan(user.id, user.username)} title="Ban User"
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-red-400 hover:bg-red-500/[0.06] transition">
                          <Ban size={14} />
                        </button>
                      ) : (
                        <button onClick={() => handleUnban(user.id, user.username)} title="Unban User"
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-green-400 hover:bg-green-500/[0.06] transition">
                          <ShieldCheck size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Activity Modal */}
      <AnimatePresence>
        {(activityData || activityLoading) && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !activityLoading && setActivityData(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-card-glow"
              onClick={e => e.stopPropagation()}
            >
              {activityLoading ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan animate-spin" />
                  <p className="text-gray-500 text-sm">Loading activity...</p>
                </div>
              ) : activityData && (
                <>
                  <div className="sticky top-0 bg-surface-card/90 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <Avatar src={activityData.user.avatar_url} alt={activityData.user.username} size="md" />
                      <div>
                        <h3 className="font-bold text-white">{activityData.user.username}</h3>
                        <p className="text-xs text-gray-500">{activityData.user.email}</p>
                      </div>
                    </div>
                    <button onClick={() => setActivityData(null)} className="p-2 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white transition">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2 p-4">
                    {[
                      { label: 'Posts', value: activityData.stats.total_posts, color: 'text-neon-cyan' },
                      { label: 'Likes Given', value: activityData.stats.total_likes, color: 'text-neon-green' },
                      { label: 'Reports Against', value: activityData.stats.reports_against, color: 'text-red-400' },
                    ].map(s => (
                      <div key={s.label} className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04] text-center">
                        <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent Posts */}
                  <div className="px-4 pb-2">
                    <p className="section-label mb-2">Recent Posts</p>
                    {activityData.recentPosts.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No posts</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activityData.recentPosts.slice(0, 5).map((post: any) => (
                          <div key={post.id} className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                            <img src={post.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-300 truncate">{post.caption || '(no caption)'}</p>
                              <p className="text-[10px] text-gray-500">{post.likes_count}♥ · {post.comments_count}💬 ·
                                <span className={`ml-1 ${post.status === 'approved' ? 'text-green-400' : post.status === 'flagged' ? 'text-red-400' : 'text-amber-400'}`}>{post.status}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Comments */}
                  <div className="px-4 pb-2">
                    <p className="section-label mb-2 mt-3">Recent Comments</p>
                    {activityData.recentComments.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No comments</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activityData.recentComments.slice(0, 5).map((c: any) => (
                          <div key={c.id} className="p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                            <p className="text-xs text-gray-300">&ldquo;{c.body}&rdquo;</p>
                            <p className="text-[10px] text-gray-500 mt-1">on post #{c.post_id} · {formatDate(c.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Devices */}
                  <div className="px-4 pb-4">
                    <p className="section-label mb-2 mt-3">Devices</p>
                    {activityData.devices.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No devices registered</p>
                    ) : (
                      <div className="space-y-1">
                        {activityData.devices.map((d: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/[0.04] text-xs">
                            <span className="font-mono text-gray-400 truncate max-w-[180px]">{d.device_fingerprint}</span>
                            <div className="flex items-center gap-2">
                              {d.is_trusted && <span className="text-green-400 text-[10px] font-bold">Trusted</span>}
                              <span className="text-gray-500">{d.last_used ? formatDate(d.last_used) : 'Never'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.label || 'Confirm'}
        danger={confirm?.danger}
        onConfirm={() => confirm?.action()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}