import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Bookmark, Grid, List, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PostCard } from '../components/feed/PostCard';
import { formatNumber } from '../lib/utils';
import { pageVariants, gridVariants, gridItemVariants } from '../lib/animations';
import toast from 'react-hot-toast';
import type { Post } from '../types';

export function SavedPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => { loadSavedPosts(); }, []);

  const loadSavedPosts = async () => {
    try { const data = await api.getSavedPosts(); setPosts(data); }
    catch { toast.error('Failed to load saved posts'); }
    finally { setIsLoading(false); }
  };

  const handleUnsave = async (postId: number) => {
    try { await api.unsavePost(postId); setPosts(posts.filter(p => p.id !== postId)); toast.success('Post removed from saved'); }
    catch { toast.error('Failed to unsave post'); }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="max-w-4xl mx-auto p-4 pb-20 md:pb-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Bookmark className="w-6 h-6 text-neon-cyan" />
          <h1 className="text-2xl font-bold text-white">Saved Posts</h1>
        </div>
        {posts.length > 0 && (
          <div className="flex items-center gap-1 bg-surface-card rounded-lg p-0.5 border border-white/[0.04]">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-gray-500'}`}>
              <Grid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-gray-500'}`}>
              <List size={16} />
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-3 gap-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="aspect-square skeleton rounded-xl" />)}
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
            <Bookmark className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-lg font-medium">No saved posts yet</p>
          <p className="text-gray-500 text-sm mt-1">Save posts to view them later</p>
        </motion.div>
      )}

      {!isLoading && posts.length > 0 && viewMode === 'grid' && (
        <motion.div variants={gridVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {posts.map(post => (
              <motion.div key={post.id} variants={gridItemVariants} layout exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                className="aspect-square bg-surface-card cursor-pointer relative group overflow-hidden rounded-xl">
                <Link to={`/post/${post.id}`}>
                  <img src={post.image_url} alt="Post" className="w-full h-full object-cover" loading="lazy" />
                </Link>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <span className="text-white font-semibold text-sm flex items-center gap-1">❤️ {formatNumber(post.likes_count || 0)}</span>
                  <button onClick={() => handleUnsave(post.id)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur transition-colors" title="Remove from saved">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!isLoading && posts.length > 0 && viewMode === 'list' && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {posts.map(post => (
            <div key={post.id} className="relative">
              <PostCard post={post as Post} />
              <button onClick={() => handleUnsave(post.id)}
                className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-lg transition">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}