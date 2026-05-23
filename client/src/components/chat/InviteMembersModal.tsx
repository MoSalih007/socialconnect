import { useState } from 'react';
import { Search, UserPlus, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface InviteMembersModalProps {
  isOpen: boolean;
  groupId: number;
  onClose: () => void;
  onInvited: () => void;
}

interface SearchUser {
  id: number;
  username: string;
  avatar_url?: string;
  full_name?: string;
}

export function InviteMembersModal({ isOpen, groupId, onClose, onInvited }: InviteMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results = await api.search(q.trim());
      const users = (results.users || results || []).filter(
        (u: SearchUser) => !selected.some(s => s.id === u.id)
      );
      setSearchResults(users.slice(0, 15));
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  };

  const handleInvite = async () => {
    if (selected.length === 0) return;
    setIsInviting(true);
    try {
      const result = await api.inviteToGroup(groupId, selected.map(u => u.id));
      const count = result.invited?.length || selected.length;
      toast.success(`${count} invitation${count > 1 ? 's' : ''} sent!`);
      onInvited();
      onClose();
      setSelected([]); setSearchQuery(''); setSearchResults([]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to invite');
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md glass shadow-card-glow"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h2 className="text-lg font-bold text-white">Invite Members</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5">
              {/* Selected chips */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selected.map(u => (
                    <span key={u.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan text-xs font-medium">
                      {u.username}
                      <button onClick={() => setSelected(prev => prev.filter(s => s.id !== u.id))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-hide">
                {isSearching && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                )}
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => { setSelected(prev => [...prev, user]); setSearchResults(prev => prev.filter(u => u.id !== user.id)); setSearchQuery(''); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition"
                  >
                    <Avatar src={user.avatar_url} alt={user.username} size="sm" />
                    <span className="text-sm font-medium text-white">{user.username}</span>
                    <UserPlus size={16} className="ml-auto text-gray-400" />
                  </button>
                ))}
              </div>

              <button
                onClick={handleInvite}
                disabled={selected.length === 0 || isInviting}
                className="w-full btn-primary mt-4 disabled:opacity-40"
              >
                {isInviting ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Invite (${selected.length})`}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
