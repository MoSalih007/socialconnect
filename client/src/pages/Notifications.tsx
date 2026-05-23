import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, UserPlus, CheckCheck, Bookmark, Camera, ShieldCheck, ShieldX, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Avatar } from '../components/ui/Avatar';
import { useNotificationStore } from '../store/useNotifications';
import { pageVariants, listVariants, listItemVariants, badgeVariants } from '../lib/animations';
import toast from 'react-hot-toast';

const ICON: Record<string, React.ReactNode> = {
  like:    <Heart className="w-5 h-5 text-red-400" fill="currentColor" />,
  comment: <MessageCircle className="w-5 h-5 text-neon-blue" fill="currentColor" />,
  follow:  <UserPlus className="w-5 h-5 text-neon-green" />,
  follow_request: <UserPlus className="w-5 h-5 text-amber-400" />,
  post_saved:         <Bookmark className="w-5 h-5 text-amber-400" fill="currentColor" />,
  screenshot_attempt: <Camera className="w-5 h-5 text-orange-400" />,
  screenshot_request: <Camera className="w-5 h-5 text-red-400" />,
};

const MESSAGE: Record<string, string> = {
  like:    'liked your post',
  comment: 'commented on your post',
  follow:  'started following you',
  follow_request: 'requested to follow you',
  post_saved:         'saved your post',
  screenshot_attempt: 'took a screenshot of your post',
  screenshot_request: 'is requesting to screenshot your post',
};

// Group notifications by time period (Instagram-style)
function groupByTime(items: any[]) {
  const now = Date.now();
  const groups: { label: string; items: any[] }[] = [];
  
  const today: any[] = [];
  const thisWeek: any[] = [];
  const thisMonth: any[] = [];
  const older: any[] = [];

  for (const item of items) {
    const diff = now - new Date(item.created_at).getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = hours / 24;

    if (hours < 24) today.push(item);
    else if (days < 7) thisWeek.push(item);
    else if (days < 30) thisMonth.push(item);
    else older.push(item);
  }

  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (thisWeek.length > 0) groups.push({ label: 'This Week', items: thisWeek });
  if (thisMonth.length > 0) groups.push({ label: 'This Month', items: thisMonth });
  if (older.length > 0) groups.push({ label: 'Earlier', items: older });

  return groups;
}

export function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { fetchUnreadCount } = useNotificationStore();

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setItems(data);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Faster polling for the notifications page — every 10s
    const interval = setInterval(loadNotifications, 10_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markRead = async (id: number) => {
    await api.markNotificationRead(id).catch(console.error);
    setItems((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    fetchUnreadCount();
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setItems((ns) => ns.map((n) => ({ ...n, is_read: true })));
      fetchUnreadCount();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleScreenshotResponse = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      await api.respondScreenshot(requestId, action);
      setItems((ns) => ns.map((n) =>
        n.screenshot_request_id === requestId ? { ...n, is_read: true } : n
      ));
      fetchUnreadCount();
      toast.success(action === 'accept' ? 'Screenshot allowed for 10 minutes' : 'Screenshot request declined');
    } catch {
      toast.error('Failed to respond');
    }
  };

  const unreadCount = items.filter(n => !n.is_read).length;
  const displayItems = filter === 'unread' ? items.filter(n => !n.is_read) : items;
  const groups = groupByTime(displayItems);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-screen pb-20 md:pb-0"
    >
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2.5 py-0.5 text-xs font-bold rounded-full"
                style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
              >
                {unreadCount} new
              </motion.span>
            )}
          </motion.div>

          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex bg-surface-card rounded-lg p-0.5 border border-white/[0.04]">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filter === 'all' ? 'bg-white/[0.08] text-white' : 'text-gray-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filter === 'unread' ? 'bg-white/[0.08] text-white' : 'text-gray-500'
                }`}
              >
                Unread
              </button>
            </div>

            {unreadCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/15 rounded-lg transition-colors border border-neon-cyan/20"
              >
                <CheckCheck size={16} />
                <span className="hidden sm:inline">Mark all read</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-surface-card border border-white/[0.04]">
                <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 skeleton rounded" />
                  <div className="h-2 w-1/3 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayItems.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
              <Bell className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg font-medium">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {filter === 'unread' ? 'You\'ve read all your notifications' : 'When people interact with your posts, you\'ll see it here'}
            </p>
          </motion.div>
        )}

        {/* Grouped notification list */}
        {!isLoading && groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="section-label px-1 mb-2">{group.label}</p>
            <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-1">
              {group.items.map((n) => (
                <motion.div
                  key={n.id}
                  variants={listItemVariants}
                  layout
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-300 group ${
                    n.is_read
                      ? 'bg-transparent border border-white/[0.04] hover:bg-white/[0.02]'
                      : 'bg-neon-cyan/[0.04] border border-neon-cyan/10 hover:bg-neon-cyan/[0.06]'
                  }`}
                >
                  {/* Icon */}
                  <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04]">
                    {ICON[n.type]}
                  </span>

                  {/* Avatar */}
                  <Link to={`/profile/${n.actor_username}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Avatar
                      src={n.actor_avatar}
                      alt={n.actor_username}
                      size="md"
                    />
                  </Link>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-gray-300">
                      <Link to={`/profile/${n.actor_username}`} className="font-bold text-white hover:text-neon-cyan transition-colors" onClick={(e) => e.stopPropagation()}>
                        {n.actor_username}
                      </Link>{' '}
                      {MESSAGE[n.type] ?? 'sent you a notification'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(n.created_at)}</p>
                  </div>

                  {/* Post thumbnail */}
                  {n.post_id && n.type !== 'screenshot_request' && (
                    <Link to={`/post/${n.post_id}`} onClick={(e) => e.stopPropagation()} className="shrink-0 w-11 h-11 rounded-lg bg-surface-card overflow-hidden hover:opacity-80 transition border border-white/[0.04]">
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">▶</div>
                    </Link>
                  )}

                  {/* Screenshot request actions */}
                  {n.type === 'screenshot_request' && !n.is_read && n.screenshot_request_id && (
                    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleScreenshotResponse(n.screenshot_request_id!, 'accept')}
                        className="p-1.5 rounded-lg text-surface-dark hover:shadow-neon-sm transition-all"
                        style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
                        title="Allow screenshot for 10 minutes"
                      >
                        <ShieldCheck size={16} />
                      </button>
                      <button
                        onClick={() => handleScreenshotResponse(n.screenshot_request_id!, 'decline')}
                        className="p-1.5 bg-white/[0.06] rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                        title="Decline and block for 1 hour"
                      >
                        <ShieldX size={16} />
                      </button>
                    </div>
                  )}

                  {/* Follow back button for follow notifications */}
                  {n.type === 'follow' && !n.is_read && (
                    <Link
                      to={`/profile/${n.actor_username}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg text-surface-dark transition-all hover:shadow-neon-sm"
                      style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
                    >
                      View
                    </Link>
                  )}

                  {/* Unread dot */}
                  <AnimatePresence>
                    {!n.is_read && (
                      <motion.span
                        variants={badgeVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="shrink-0 w-2.5 h-2.5 bg-neon-cyan rounded-full"
                        style={{ boxShadow: '0 0 8px rgba(0, 255, 209, 0.5)' }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}