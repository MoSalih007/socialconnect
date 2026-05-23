import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Check, Trash2, RefreshCw, X, ZoomIn, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface FlaggedPost {
  id: number; caption: string; image_url: string; status: string;
  created_at: string; username: string; avatar_url: string;
  likes_count: number; comments_count: number; media_type?: string;
}

export function ContentModeration() {
  const [posts, setPosts] = useState<FlaggedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    setIsLoading(true);
    try { const data = await api.getFlaggedPosts(); setPosts(data); }
    catch { toast.error('Failed to load flagged posts'); }
    finally { setIsLoading(false); }
  };

  const handleApprove = async (postId: number) => {
    setProcessing(postId);
    try {
      await api.approvePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success('Post approved');
    } catch { toast.error('Failed to approve'); }
    finally { setProcessing(null); }
  };

  const handleDelete = async (postId: number) => {
    setProcessing(postId);
    try {
      await api.deletePostAdmin(postId);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success('Post deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setProcessing(null); }
  };

  const openPreview = (url: string, type?: string) => {
    setPreviewType(type === 'video' ? 'video' : 'image');
    setPreviewUrl(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Moderation</h1>
          <p className="text-xs text-gray-500 mt-1">Review flagged & pending posts</p>
        </div>
        <button onClick={loadPosts} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass overflow-hidden">
              <div className="aspect-video skeleton" /><div className="p-4 space-y-2"><div className="h-3 w-24 skeleton rounded" /><div className="h-2 w-48 skeleton rounded" /></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && posts.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
            <Check className="w-7 h-7 text-neon-green" />
          </div>
          <p className="text-gray-400 font-medium text-lg">All clear!</p>
          <p className="text-gray-500 text-sm">No flagged or pending posts to review</p>
        </motion.div>
      )}

      {/* Post grid */}
      {!isLoading && posts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06 }}
                layout
                className="glass overflow-hidden"
              >
                {/* Image/Video */}
                <div className="aspect-video bg-surface-dark relative group cursor-pointer" onClick={() => openPreview(post.image_url, post.media_type)}>
                  {post.media_type === 'video' ? (
                    <video src={post.image_url} muted preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={post.image_url} alt="Post content" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {post.media_type === 'video' ? <Play size={28} className="text-white fill-white" /> : <ZoomIn size={24} className="text-white" />}
                  </div>
                  {/* Status badge */}
                  <span className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                    post.status === 'flagged'
                      ? 'bg-red-500/80 text-white'
                      : 'bg-amber-500/80 text-white'
                  }`}>
                    {post.status}
                  </span>
                </div>

                {/* Post Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar src={post.avatar_url} alt={post.username} size="sm" />
                    <span className="font-semibold text-sm text-white">{post.username}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">{formatDate(post.created_at)}</span>
                  </div>

                  {post.caption && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{post.caption}</p>
                  )}

                  <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-3 uppercase tracking-wider font-semibold">
                    <span>{post.likes_count} likes</span>
                    <span>{post.comments_count} comments</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(post.id)}
                      disabled={processing === post.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-surface-dark disabled:opacity-50 transition hover:shadow-neon-sm"
                      style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={processing === post.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 disabled:opacity-50 transition"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Image/Video Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.1] text-white hover:bg-white/20 transition" onClick={() => setPreviewUrl(null)}>
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-4xl max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              {previewType === 'video' ? (
                <video src={previewUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl" />
              ) : (
                <img src={previewUrl} alt="Full preview" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
