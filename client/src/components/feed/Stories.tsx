import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { fileToBase64 } from '../../lib/utils';
import type { Story } from '../../types';
import toast from 'react-hot-toast';

const STORY_DURATION_MS = 5000;

interface StoryViewer {
  id: number;
  username: string;
  avatar_url?: string;
  viewed_at: string;
}

export function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    api.getStories().then(setStories).catch(console.error);
  }, []);

  // Timer logic — supports pause/resume
  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current!);
    startTimeRef.current = Date.now() - elapsedRef.current;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = (elapsed / STORY_DURATION_MS) * 100;
      if (pct >= 100) { clearInterval(intervalRef.current!); advance(); }
      else { setProgress(pct); }
    }, 40);
  }, []);

  const pauseTimer = useCallback(() => {
    clearInterval(intervalRef.current!);
    elapsedRef.current = Date.now() - startTimeRef.current;
  }, []);

  useEffect(() => {
    if (viewingIndex === null) return;
    // Reset for new story
    elapsedRef.current = 0;
    setProgress(0);
    setShowViewers(false);
    setViewers([]);
    setViewCount(0);

    const story = stories[viewingIndex];
    if (!story) return;

    // Record view (fires silently, backend skips self-views)
    api.recordStoryView(story.id).catch(() => {});

    // If it's our own story, fetch view data
    if (story.user_id === user?.id) {
      api.getStoryViews(story.id)
        .then((data: { views: StoryViewer[]; count: number }) => {
          setViewers(data.views || []);
          setViewCount(data.count || 0);
        })
        .catch(() => {});
    }

    startTimer();
    return () => clearInterval(intervalRef.current!);
  }, [viewingIndex]);

  // Pause/resume when viewers panel toggles
  useEffect(() => {
    if (viewingIndex === null) return;
    if (isPaused || showViewers) {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [isPaused, showViewers]);

  const openStory = (i: number) => setViewingIndex(i);
  const closeStory = () => { clearInterval(intervalRef.current!); setViewingIndex(null); setShowViewers(false); setIsPaused(false); };
  const advance = () => {
    setViewingIndex((prev) => {
      if (prev !== null && prev < stories.length - 1) return prev + 1;
      closeStory(); return null;
    });
  };
  const goBack = () => {
    setViewingIndex((prev) => (prev !== null && prev > 0) ? prev - 1 : prev);
  };

  const handleCreateStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setIsCreating(true);
    try {
      const base64 = await fileToBase64(file);
      await api.createStory(base64);
      const updated = await api.getStories();
      setStories(updated);
      toast.success('Story created!');
    } catch { toast.error('Failed to create story'); }
    finally { setIsCreating(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDeleteStory = async () => {
    if (!viewing || isDeleting) return;
    const storyId = viewing.id;
    setIsDeleting(true);
    try {
      await api.deleteStory(storyId);
      toast.success('Story deleted');
      // Close the viewer first, then refresh the list
      clearInterval(intervalRef.current!);
      setViewingIndex(null);
      setShowViewers(false);
      setIsPaused(false);
      const updated = await api.getStories();
      setStories(updated);
    } catch {
      toast.error('Failed to delete story');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleViewers = () => {
    setShowViewers(prev => !prev);
  };

  const formatViewTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const viewing = viewingIndex !== null ? stories[viewingIndex] : null;
  const isOwnStory = viewing && user && viewing.user_id === user.id;

  return (
    <>
      {/* Thumbnails strip */}
      <div className="glass p-4 mb-6 overflow-hidden">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {/* Create Story button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isCreating}
            className="flex flex-col items-center gap-1.5 min-w-[68px] focus:outline-none"
          >
            <div className="relative">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)', boxShadow: '0 0 20px rgba(0,255,209,0.2)' }}
              >
                {isCreating ? (
                  <div className="w-6 h-6 border-2 border-surface-dark border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-7 h-7 text-surface-dark" />
                )}
              </div>
              {user?.avatar_url && (
                <img src={user.avatar_url} alt="" className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-surface-dark object-cover" />
              )}
            </div>
            <p className="text-[11px] font-medium text-gray-400">Your Story</p>
          </motion.button>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleCreateStory} className="hidden" />

          {stories.length === 0 ? (
            <div className="flex items-center px-2">
              <p className="text-sm text-gray-500 whitespace-nowrap">No stories right now</p>
            </div>
          ) : (
            stories.map((story, i) => (
              <motion.button
                key={story.id}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 + 0.08, type: 'spring', stiffness: 360, damping: 24 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => openStory(i)}
                className="flex flex-col items-center gap-1.5 min-w-[68px] focus:outline-none"
              >
                <div className="relative">
                  <div
                    className="w-[68px] h-[68px] rounded-full p-[3px]"
                    style={{
                      background: 'linear-gradient(135deg, #00FFD1, #00d4ff, #8b5cf6, #00FFD1)',
                      backgroundSize: '300% 300%',
                      animation: 'gradientFlow 3s ease infinite',
                    }}
                  >
                    <div className="w-full h-full rounded-full border-2 border-surface-dark overflow-hidden">
                      <img src={story.avatar_url || '/default-avatar.png'} alt={story.username || 'Story'} className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
                <p className="text-xs truncate w-full text-center text-gray-400">{story.username}</p>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {viewing && viewingIndex !== null && (
          <motion.div
            key="story-viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={closeStory}
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 flex gap-1 p-3 pt-safe z-10">
              {stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-none"
                    style={{
                      width: i < viewingIndex ? '100%' : i === viewingIndex ? `${progress}%` : '0%',
                      background: 'linear-gradient(90deg, #00FFD1, #00d4ff)',
                      boxShadow: i === viewingIndex ? '0 0 8px rgba(0,255,209,0.5)' : 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header: avatar + username + actions */}
            <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-20" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Avatar src={viewing.avatar_url} alt={viewing.username || 'User'} size="sm" />
                <span className="text-white font-semibold text-sm drop-shadow">{viewing.username}</span>
              </div>

              <div className="flex items-center gap-1">
                {/* Delete button — only for own stories */}
                {isOwnStory && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleDeleteStory}
                    disabled={isDeleting}
                    className="p-1.5 text-white hover:bg-red-500/20 rounded-full transition"
                    title="Delete story"
                  >
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={20} />
                    )}
                  </motion.button>
                )}
                {/* Close button */}
                <motion.button whileTap={{ scale: 0.85, rotate: 90 }} onClick={closeStory} className="p-1.5 text-white hover:bg-white/10 rounded-full transition">
                  <X size={22} />
                </motion.button>
              </div>
            </div>

            {/* Story image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={viewingIndex}
                src={viewing.image_url}
                alt="Story"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                className="max-w-sm w-full max-h-[86vh] rounded-2xl object-cover"
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            </AnimatePresence>

            {/* Navigation zones */}
            <button onClick={(e) => { e.stopPropagation(); goBack(); }} className="absolute left-0 top-0 w-1/3 h-full z-10 flex items-center">
              {viewingIndex > 0 && <ChevronLeft size={28} className="text-white/60 ml-2 drop-shadow" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); advance(); }} className="absolute right-0 top-0 w-1/3 h-full z-10 flex items-center justify-end">
              <ChevronRight size={28} className="text-white/60 mr-2 drop-shadow" />
            </button>

            {/* Bottom: View count for own stories */}
            {isOwnStory && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={(e) => { e.stopPropagation(); toggleViewers(); }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all"
                style={{
                  background: showViewers
                    ? 'linear-gradient(135deg, rgba(0,255,209,0.25), rgba(0,212,255,0.25))'
                    : 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  border: showViewers ? '1px solid rgba(0,255,209,0.4)' : '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <Eye size={18} className={showViewers ? 'text-neon-cyan' : 'text-white/80'} />
                <span className={`text-sm font-semibold ${showViewers ? 'text-neon-cyan' : 'text-white/80'}`}>
                  {viewCount}
                </span>
              </motion.button>
            )}

            {/* Viewers panel — slides up from bottom */}
            <AnimatePresence>
              {showViewers && isOwnStory && (
                <motion.div
                  key="viewers-panel"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-0 left-0 right-0 z-30 max-h-[55vh] flex flex-col"
                  style={{
                    background: 'linear-gradient(to top, rgba(15,15,20,0.98), rgba(15,15,20,0.92))',
                    backdropFilter: 'blur(20px)',
                    borderTopLeftRadius: '20px',
                    borderTopRightRadius: '20px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {/* Handle bar */}
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-neon-cyan" />
                      <span className="text-white font-semibold text-sm">
                        {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowViewers(false)}
                      className="text-xs text-gray-500 hover:text-white transition"
                    >
                      Close
                    </button>
                  </div>

                  {/* Viewer list */}
                  <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
                    {viewers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Eye size={32} className="text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No viewers yet</p>
                        <p className="text-xs text-gray-600 mt-1">Views will appear here</p>
                      </div>
                    ) : (
                      viewers.map((viewer) => (
                        <motion.div
                          key={viewer.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/[0.04] transition"
                        >
                          <Avatar src={viewer.avatar_url} alt={viewer.username} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{viewer.username}</p>
                          </div>
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            {formatViewTime(viewer.viewed_at)}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}