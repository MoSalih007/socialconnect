import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { listItemVariants } from '../../lib/animations';
import toast from 'react-hot-toast';

interface Suggestion {
  id: number;
  username: string;
  avatar_url?: string;
  full_name?: string;
  mutual_count: number;
}

export function SuggestedPeople() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.getSuggestions()
      .then((data: Suggestion[]) => setSuggestions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFollow = async (userId: number) => {
    try {
      await api.follow(userId);
      setSuggestions(prev => prev.filter(s => s.id !== userId));
      toast.success('Following!');
    } catch {
      toast.error('Failed to follow');
    }
  };

  if (loading || suggestions.length === 0 || dismissed) return null;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-sm">Suggested Connections</h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Hide
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {suggestions.slice(0, 4).map((user) => (
            <motion.div
              key={user.id}
              variants={listItemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              layout
              className="flex items-center gap-3"
            >
              <Link to={`/profile/${user.username}`}>
                <Avatar src={user.avatar_url} alt={user.username} size="md" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/profile/${user.username}`}
                  className="text-sm font-semibold text-white hover:text-neon-cyan transition-colors block truncate"
                >
                  {user.username}
                </Link>
                {user.full_name && (
                  <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleFollow(user.id)}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-all duration-300"
              >
                Follow
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button className="w-full text-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-neon-cyan transition-colors mt-4 pt-3 border-t border-white/[0.04]">
        View All Connections
      </button>
    </div>
  );
}
