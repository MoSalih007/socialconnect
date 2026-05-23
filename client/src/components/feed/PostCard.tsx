import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Flag, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { Post, Comment } from '../../types';
import { Avatar } from '../ui/Avatar';
import { formatDate, formatNumber } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import {
  likeVariants,
  doubleTapHeartVariants,
  dropdownVariants,
  listVariants,
  listItemVariants,
} from '../../lib/animations';
import { useContentProtection } from '../../hooks/useContentProtection';
import toast from 'react-hot-toast';

interface PostCardProps {
  post: Post;
  onUpdate?: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [isSaved, setIsSaved] = useState(post.is_saved ?? false);
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsCount, setCommentsCount] = useState(Number(post.comments_count) || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const heartControls = useAnimation();
  const bookmarkControls = useAnimation();
  const lastTapRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwnPost = currentUser?.id === post.user_id;
  const ownerIsPrivate = !!post.owner_is_private;

  // Content protection: detect screenshots + right-click
  useContentProtection({ postId: post.id, ownerIsPrivate, isOwnPost });

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const triggerLike = async (toLike: boolean) => {
    try {
      if (toLike) {
        await api.likePost(post.id);
        setLikesCount((c) => c + 1);
      } else {
        await api.unlikePost(post.id);
        setLikesCount((c) => c - 1);
      }
      setIsLiked(toLike);
      await heartControls.start(toLike ? 'liked' : 'unliked');
    } catch {
      toast.error('Action failed');
    }
  };

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      if (!isLiked) triggerLike(true);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 950);
    }
    lastTapRef.current = now;
  };

  const handleSave = async () => {
    bookmarkControls.start({
      scale: [1, 1.35, 0.88, 1.12, 1],
      rotate: [0, -12, 8, -4, 0],
      transition: { duration: 0.45 },
    });
    try {
      if (isSaved) {
        await api.unsavePost(post.id);
        toast.success('Removed from saved');
      } else {
        await api.savePost(post.id);
        toast.success('Saved ✓');
      }
      setIsSaved(!isSaved);
    } catch {
      toast.error('Action failed');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast(url);
    }
    setShowMenu(false);
  };

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      try {
        const data = await api.getComments(post.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch {
        toast.error('Could not load comments');
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const newComment = await api.addComment(post.id, commentText.trim());
      setComments((prev) => [{ ...newComment, username: currentUser?.username }, ...prev]);
      setCommentText('');
      setCommentsCount((c) => c + 1);
    } catch {
      toast.error('Could not post comment');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.deletePost(post.id);
      toast.success('Post deleted');
      onUpdate?.();
    } catch {
      toast.error('Could not delete');
    }
    setShowMenu(false);
  };

  const handleReport = async () => {
    try {
      await api.reportPost(post.id, 'Inappropriate content');
      toast.success('Post reported. Thank you.');
    } catch {
      toast.error('Could not report post');
    }
    setShowMenu(false);
  };

  return (
    <motion.div
      layout
      className="glass mb-4 overflow-hidden hover:border-white/[0.1] transition-colors duration-500"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link to={`/profile/${post.username}`} className="flex items-center gap-3 group">
          <Avatar src={post.avatar_url} alt={post.username || 'User'} size="md" />
          <div>
            <p className="font-bold text-sm text-white group-hover:text-neon-cyan transition-colors">{post.username}</p>
            <p className="text-xs text-gray-500">{formatDate(post.created_at)}</p>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => setShowMenu((v) => !v)}
            className="p-2 hover:bg-white/[0.06] rounded-full transition"
          >
            <MoreHorizontal size={20} className="text-gray-500" />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 top-10 z-20 min-w-[160px] glass shadow-card-glow overflow-hidden"
              >
                <button
                  onClick={handleShare}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/[0.06] transition"
                >
                  Copy link
                </button>
                {isOwnPost && (
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 border-t border-white/[0.04] transition"
                  >
                    Delete post
                  </button>
                )}
                {!isOwnPost && (
                  <button
                    onClick={handleReport}
                    className="w-full text-left px-4 py-3 text-sm text-amber-400 hover:bg-amber-500/10 border-t border-white/[0.04] transition flex items-center gap-2"
                  >
                    <Flag size={14} /> Report
                  </button>
                )}
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-500 border-t border-white/[0.04] hover:bg-white/[0.04] transition"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Media */}
      <div
        className={`${post.media_type === 'video' ? '' : 'aspect-square'} bg-surface relative cursor-pointer select-none`}
        onClick={post.media_type === 'video' ? undefined : handleImageTap}
        data-protected={ownerIsPrivate && !isOwnPost ? 'true' : undefined}
        style={ownerIsPrivate && !isOwnPost ? { WebkitUserSelect: 'none' } : undefined}
      >
        {post.media_type === 'video' ? (
          <video
            src={post.image_url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[600px] object-contain bg-black"
          />
        ) : (
          <motion.img
            src={post.image_url}
            alt={post.caption || 'Post'}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={imageLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        )}

        {post.media_type === 'video' && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/80 text-white backdrop-blur-sm uppercase tracking-wider">
            🎬 Video
          </span>
        )}

        <AnimatePresence>
          {showHeart && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              variants={doubleTapHeartVariants}
              initial="hidden"
              animate="visible"
            >
              <Heart size={88} className="text-white drop-shadow-2xl" fill="white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action bar */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-5">
            <motion.button
              variants={likeVariants}
              initial="idle"
              animate={heartControls}
              whileTap={{ scale: 0.82 }}
              onClick={() => triggerLike(!isLiked)}
              className="flex items-center gap-1.5 transition-colors"
            >
              <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'text-neon-cyan' : 'text-gray-400'} />
              <span className="text-sm font-semibold text-gray-300">{formatNumber(likesCount)}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={handleToggleComments}
              className="flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle size={22} fill={showComments ? 'currentColor' : 'none'} className={showComments ? 'text-neon-cyan' : 'text-gray-400'} />
              <span className="text-sm font-semibold text-gray-300">{formatNumber(commentsCount)}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.82, rotate: -20 }}
              onClick={handleShare}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <Share2 size={20} />
            </motion.button>
          </div>

          {(!ownerIsPrivate || isOwnPost) ? (
            <motion.button
              animate={bookmarkControls}
              whileTap={{ scale: 0.78 }}
              onClick={handleSave}
              className={`transition-colors ${isSaved ? 'text-neon-cyan' : 'text-gray-400 hover:text-white'}`}
            >
              <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} />
            </motion.button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <Lock size={14} />
              Protected
            </span>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm mb-2 leading-relaxed text-gray-300">
            <Link to={`/profile/${post.username}`} className="font-bold mr-1.5 text-white hover:text-neon-cyan transition-colors">
              {post.username}
            </Link>
            {post.caption}
          </p>
        )}

        {/* View comments */}
        {!showComments && commentsCount > 0 && (
          <button
            onClick={handleToggleComments}
            className="text-sm text-gray-500 mb-2 hover:text-gray-300 transition-colors"
          >
            View all {commentsCount} comments
          </button>
        )}

        {/* Comments accordion */}
        <AnimatePresence initial={false}>
          {showComments && (
            <motion.div
              key="comments"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="pt-2 pb-1 mt-1 border-t border-white/[0.04] space-y-2"
              >
                {comments.map((c) => (
                  <motion.div key={c.id} variants={listItemVariants} className="flex gap-2 text-sm">
                    <Link to={`/profile/${c.username}`} className="font-bold text-white hover:text-neon-cyan shrink-0 transition-colors">
                      {c.username}
                    </Link>
                    <span className="text-gray-400 break-words">{c.body}</span>
                  </motion.div>
                ))}
                {commentsLoaded && comments.length === 0 && (
                  <p className="text-sm text-gray-600 py-1">No comments yet. Be first!</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add comment */}
        <form
          onSubmit={handleAddComment}
          className="flex items-center gap-2 mt-2 border-t border-white/[0.04] pt-3"
        >
          <input
            type="text"
            placeholder="Add a comment…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder-gray-600 text-gray-300"
            maxLength={1000}
          />
          <AnimatePresence>
            {commentText.trim() && (
              <motion.button
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ duration: 0.14 }}
                type="submit"
                className="text-neon-cyan font-bold text-sm shrink-0 uppercase tracking-wider"
              >
                Post
              </motion.button>
            )}
          </AnimatePresence>
        </form>
      </div>
    </motion.div>
  );
}