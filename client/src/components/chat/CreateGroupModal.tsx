import { useState } from 'react';
import { X, Search, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface SearchUser {
  id: number;
  username: string;
  avatar_url?: string;
  full_name?: string;
}

export function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const [step, setStep] = useState<'info' | 'members'>('info');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results = await api.search(q.trim());
      const users = (results.users || results || []).filter(
        (u: SearchUser) => !selectedMembers.some(s => s.id === u.id)
      );
      setSearchResults(users.slice(0, 20));
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  };

  const addMember = (user: SearchUser) => {
    if (selectedMembers.length >= 49) { toast.error('Max 49 members'); return; }
    setSelectedMembers(prev => [...prev, user]);
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
    setSearchQuery('');
  };

  const removeMember = (userId: number) => {
    setSelectedMembers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { toast.error('Group name is required'); return; }
    setIsCreating(true);
    try {
      await api.createGroup(
        groupName.trim(),
        selectedMembers.map(m => m.id),
        description.trim() || undefined
      );
      toast.success('Group created!');
      onCreated();
      onClose();
      // Reset
      setGroupName(''); setDescription(''); setSelectedMembers([]); setStep('info');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md glass shadow-card-glow"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h2 className="text-lg font-bold text-white">
                {step === 'info' ? 'New Group' : 'Add Members'}
              </h2>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5">
              {step === 'info' ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Group Name *
                      </label>
                      <input
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="e.g., Study Group"
                        maxLength={100}
                        className="w-full px-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Description (optional)
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="What's this group about?"
                        maxLength={500}
                        rows={3}
                        className="w-full px-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/[0.04] transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setStep('members')}
                      disabled={!groupName.trim()}
                      className="flex-1 btn-primary disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Selected members chips */}
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedMembers.map(m => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan text-xs font-medium"
                        >
                          {m.username}
                          <button onClick={() => removeMember(m.id)} className="hover:text-white transition">
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
                      placeholder="Search users to invite..."
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                    />
                  </div>

                  {/* Results */}
                  <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                    {isSearching && (
                      <div className="flex justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-gray-400" />
                      </div>
                    )}
                    {!isSearching && searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => addMember(user)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition"
                      >
                        <Avatar src={user.avatar_url} alt={user.username} size="sm" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{user.username}</p>
                          {user.full_name && <p className="text-xs text-gray-500">{user.full_name}</p>}
                        </div>
                        <UserPlus size={16} className="ml-auto text-gray-400" />
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => setStep('info')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/[0.04] transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={isCreating}
                      className="flex-1 btn-primary disabled:opacity-40"
                    >
                      {isCreating ? (
                        <Loader2 size={16} className="animate-spin mx-auto" />
                      ) : (
                        `Create${selectedMembers.length > 0 ? ` (${selectedMembers.length})` : ''}`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
