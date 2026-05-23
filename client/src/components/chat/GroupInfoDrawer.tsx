import { useState } from 'react';
import { X, UserPlus, LogOut, Shield, ShieldOff, VolumeX, Volume2, Trash2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import type { GroupMember } from '../../types';
import toast from 'react-hot-toast';

interface GroupInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  group: {
    id: number;
    name: string;
    description?: string;
    created_by: number;
    member_count: number;
    my_role: 'admin' | 'member';
    my_muted: boolean;
    is_muted_all: boolean;
  } | null;
  members: GroupMember[];
  currentUserId: number;
  onRefresh: () => void;
  onOpenInvite: () => void;
  onLeave: () => void;
}

export function GroupInfoDrawer({
  isOpen, onClose, group, members, currentUserId, onRefresh, onOpenInvite, onLeave,
}: GroupInfoDrawerProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen || !group) return null;

  const isAdmin = group.my_role === 'admin';
  const isCreator = group.created_by === currentUserId;

  const handleKick = async (userId: number, username: string) => {
    if (!confirm(`Remove ${username} from the group?`)) return;
    setLoading(`kick-${userId}`);
    try {
      await api.kickFromGroup(group.id, userId);
      toast.success(`${username} removed`);
      onRefresh();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(null); }
  };

  const handleRoleChange = async (userId: number, newRole: 'admin' | 'member') => {
    setLoading(`role-${userId}`);
    try {
      await api.updateMemberRole(group.id, userId, newRole);
      toast.success(`Role updated`);
      onRefresh();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(null); }
  };

  const handleToggleMute = async () => {
    setLoading('mute');
    try {
      await api.muteGroup(group.id, !group.my_muted);
      toast.success(group.my_muted ? 'Unmuted' : 'Muted');
      onRefresh();
    } catch { toast.error('Failed'); }
    finally { setLoading(null); }
  };

  const handleToggleMuteAll = async () => {
    setLoading('mute-all');
    try {
      await api.toggleMuteAll(group.id, !group.is_muted_all);
      toast.success(group.is_muted_all ? 'All members can send' : 'Only admins can send');
      onRefresh();
    } catch { toast.error('Failed'); }
    finally { setLoading(null); }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Delete this group permanently? This cannot be undone.')) return;
    setLoading('delete');
    try {
      await api.deleteGroup(group.id);
      toast.success('Group deleted');
      onClose();
      onLeave();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(null); }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
        />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-sm glass border-l border-white/[0.06] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <h2 className="text-lg font-bold text-white">Group Info</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Group name & description */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #00d4ff 100%)' }}>
                <span className="text-xl font-bold text-surface-dark">
                  {group.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">{group.name}</h3>
              {group.description && (
                <p className="text-sm text-gray-400 mt-1">{group.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">{group.member_count} member{group.member_count !== 1 ? 's' : ''}</p>
            </div>

            {/* Actions */}
            <div className="space-y-1">
              <button
                onClick={onOpenInvite}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-left"
              >
                <UserPlus size={18} className="text-neon-cyan" />
                <span className="text-sm font-medium text-white">Invite Members</span>
              </button>

              <button
                onClick={handleToggleMute}
                disabled={loading === 'mute'}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-left"
              >
                {group.my_muted ? <Volume2 size={18} className="text-gray-400" /> : <VolumeX size={18} className="text-gray-400" />}
                <span className="text-sm font-medium text-white">
                  {group.my_muted ? 'Unmute Notifications' : 'Mute Notifications'}
                </span>
              </button>

              {isAdmin && (
                <button
                  onClick={handleToggleMuteAll}
                  disabled={loading === 'mute-all'}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-left"
                >
                  {group.is_muted_all ? <Volume2 size={18} className="text-orange-400" /> : <VolumeX size={18} className="text-orange-400" />}
                  <span className="text-sm font-medium text-white">
                    {group.is_muted_all ? 'Allow All to Send' : 'Only Admins Can Send'}
                  </span>
                </button>
              )}
            </div>

            {/* Members */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Members</h4>
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition group">
                    <Avatar src={m.avatar_url} alt={m.username} size="sm" isOnline={m.is_online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white truncate">{m.username}</span>
                        {m.role === 'admin' && (
                          <Crown size={12} className="text-yellow-400 flex-shrink-0" />
                        )}
                        {m.user_id === group.created_by && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan">Creator</span>
                        )}
                      </div>
                      {m.full_name && <p className="text-xs text-gray-500 truncate">{m.full_name}</p>}
                    </div>

                    {/* Admin actions (only show for others, not self, not creator) */}
                    {isCreator && m.user_id !== currentUserId && (
                      <div className="hidden group-hover:flex items-center gap-1">
                        {m.role === 'member' ? (
                          <button
                            onClick={() => handleRoleChange(m.user_id, 'admin')}
                            disabled={loading === `role-${m.user_id}`}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition" title="Make admin"
                          >
                            <Shield size={14} className="text-yellow-400" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(m.user_id, 'member')}
                            disabled={loading === `role-${m.user_id}`}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition" title="Remove admin"
                          >
                            <ShieldOff size={14} className="text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleKick(m.user_id, m.username)}
                          disabled={loading === `kick-${m.user_id}`}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition" title="Remove from group"
                        >
                          <X size={14} className="text-red-400" />
                        </button>
                      </div>
                    )}
                    {isAdmin && !isCreator && m.user_id !== currentUserId && m.user_id !== group.created_by && m.role !== 'admin' && (
                      <button
                        onClick={() => handleKick(m.user_id, m.username)}
                        disabled={loading === `kick-${m.user_id}`}
                        className="hidden group-hover:block p-1.5 rounded-lg hover:bg-red-500/10 transition" title="Remove"
                      >
                        <X size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <button
                onClick={() => { if (confirm('Leave this group?')) { onLeave(); onClose(); } }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition text-left"
              >
                <LogOut size={18} className="text-red-400" />
                <span className="text-sm font-medium text-red-400">Leave Group</span>
              </button>

              {isCreator && (
                <button
                  onClick={handleDeleteGroup}
                  disabled={loading === 'delete'}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition text-left"
                >
                  <Trash2 size={18} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">Delete Group</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
