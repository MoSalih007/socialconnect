import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Home, Compass, Bell, MessageCircle, User, Bookmark } from 'lucide-react';
import { PostCard } from '../components/feed/PostCard';
import { Stories } from '../components/feed/Stories';
import { SuggestedPeople } from '../components/feed/SuggestedPeople';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { pageVariants, listVariants, listItemVariants } from '../lib/animations';
import type { Post } from '../types';
import toast from 'react-hot-toast';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

// Left sidebar navigation
function LeftSidebar() {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Compass, label: 'Explore' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/messages', icon: MessageCircle, label: 'Messages' },
    { to: '/saved', icon: Bookmark, label: 'Saved Posts' },
    { to: `/profile/${user?.username}`, icon: User, label: 'Profile' },
  ];

  return (
    <div className="hidden lg:block w-56 flex-shrink-0">
      <div className="sticky top-20 space-y-2">
        {/* Nav links */}
        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  active
                    ? 'text-neon-cyan'
                    : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                }`}
                style={active ? { background: 'var(--color-accent-soft)' } : undefined}
              >
                <Icon size={20} fill={active ? 'currentColor' : 'none'} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Create Post button */}
        <Link to="/create" className="block mt-4">
          <button
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 hover:shadow-neon-lg hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #00d4ff)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
          >
            Create Post
          </button>
        </Link>
      </div>
    </div>
  );
}

// Right sidebar — Suggested People
function RightSidebar() {
  return (
    <div className="hidden xl:block w-72 flex-shrink-0">
      <div className="sticky top-20 space-y-6">
        <SuggestedPeople />

        <p className="text-[10px] text-gray-600 px-1">
          SocialConnect · ADBMS PBL Project · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const data = await api.getPosts();
      setPosts(data);
    } catch {
      toast.error('Failed to load feed');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-screen pb-20 md:pb-0"
    >
      <div className="max-w-7xl mx-auto px-4 pt-6 flex gap-8">
        <LeftSidebar />

        {/* Center column — posts */}
        <div className="flex-1 max-w-2xl mx-auto">
          {/* Stories */}
          <Stories />

          {/* Welcome header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5"
          >
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
              {getGreeting()}, {user?.username || 'there'}
              <Sparkles className="w-5 h-5 text-neon-cyan" />
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Here's what's happening in your feed
            </p>
          </motion.div>

          {/* Refresh button */}
          <div className="flex justify-end mb-3">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => loadPosts(true)}
              className="p-2 text-gray-500 hover:text-neon-cyan transition-colors rounded-lg hover:bg-white/[0.04]"
              title="Refresh feed"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  isRefreshing
                    ? { repeat: Infinity, duration: 0.65, ease: 'linear' }
                    : { duration: 0 }
                }
              >
                <RefreshCw size={18} />
              </motion.div>
            </motion.button>
          </div>

          {/* Skeleton */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-full skeleton" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-28 skeleton rounded" />
                      <div className="h-2 w-16 skeleton rounded" />
                    </div>
                  </div>
                  <div className="aspect-square skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="flex gap-4">
                      {[1,2,3].map(j => <div key={j} className="w-6 h-6 skeleton rounded" />)}
                    </div>
                    <div className="h-3 w-20 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          <AnimatePresence>
            {!isLoading && posts.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-400 text-lg font-medium">Your feed is empty</p>
                <p className="text-gray-500 text-sm mt-1 mb-6">Follow people to see their posts here</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link to="/search" className="btn-primary !inline-flex items-center gap-2">
                    <Compass size={16} />
                    Discover People
                  </Link>
                  <Link to="/create" className="inline-flex items-center gap-2 px-6 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/[0.04] transition-all uppercase tracking-wider">
                    Create Your First Post
                  </Link>
                </div>

                {/* Show suggested people inline for empty feeds */}
                <div className="mt-8 text-left">
                  <SuggestedPeople />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Posts list */}
          {!isLoading && posts.length > 0 && (
            <motion.div variants={listVariants} initial="hidden" animate="visible">
              {posts.map((post) => (
                <motion.div key={post.id} variants={listItemVariants}>
                  <PostCard post={post} onUpdate={() => loadPosts()} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        <RightSidebar />
      </div>
    </motion.div>
  );
}