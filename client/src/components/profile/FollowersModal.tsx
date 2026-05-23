import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface UserItem {
  id: number;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_following: boolean;
}

interface FollowersModalProps {
  userId: number;
  mode: 'followers' | 'following';
  onClose: () => void;
}

export function FollowersModal({ userId, mode, onClose }: FollowersModalProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadUsers(); }, [userId, mode]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = mode === 'followers'
        ? await (api as any).getFollowers(userId)
        : await (api as any).getFollowing(userId);
      setUsers(data);
    } catch { console.error('Failed to load'); }
    finally { setIsLoading(false); }
  };

  const handleFollow = async (targetId: number, currentlyFollowing: boolean) => {
    try {
      if (currentlyFollowing) await api.unfollow(targetId);
      else await api.follow(targetId);
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_following: !currentlyFollowing } : u));
    } catch { console.error('Follow error'); }
  };

  const goToProfile = (username: string) => { onClose(); navigate(`/profile/${username}`); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-sm mx-4 overflow-hidden shadow-card-glow" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="w-6" />
          <h3 className="font-bold text-white">
            {mode === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* User List */}
        <div className="max-h-96 overflow-y-auto scrollbar-hide">
          {isLoading && <div className="p-8 text-center text-gray-500">Loading...</div>}

          {!isLoading && users.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {mode === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </div>
          )}

          {!isLoading && users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors">
              <button type="button" onClick={() => goToProfile(u.username)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar src={u.avatar_url} alt={u.username} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-white">{u.username}</p>
                  {u.full_name && <p className="text-xs text-gray-500 truncate">{u.full_name}</p>}
                </div>
              </button>
              {u.id !== currentUser?.id && (
                <Button size="sm" variant={u.is_following ? 'secondary' : 'primary'} onClick={() => handleFollow(u.id, u.is_following)}>
                  {u.is_following ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}