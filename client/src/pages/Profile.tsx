import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Grid, List, MessageCircle, Play, Film, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { FollowersModal } from '../components/profile/FollowersModal';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { formatNumber } from '../lib/utils';
import {
  pageVariants,
  profileAvatarVariants,
  profileInfoVariants,
  gridVariants,
  gridItemVariants,
} from '../lib/animations';
import type { Post } from '../types';

interface ProfileUser {
  id: number;
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  is_private?: boolean;
  is_following?: boolean;
  posts_count?: number;
  followers_count?: number;
  following_count?: number;
  has_story?: boolean;
  is_online?: boolean;
  last_active?: string;
  created_at?: string;
}

export function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const postsGridRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'followers' | 'following' | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos'>('posts');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    if (username) loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProfile(username!);
      setUser(data);
      setPosts(data.posts || []);
      if (data.is_following !== undefined) {
        setIsFollowing(data.is_following);
      }
    } catch (error) {
      console.error('Profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) return;
    try {
      if (isFollowing) {
        await api.unfollow(user.id);
        setUser(prev => prev ? { ...prev, followers_count: (prev.followers_count || 1) - 1 } : prev);
      } else {
        await api.follow(user.id);
        setUser(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev);
      }
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  const scrollToPosts = () => {
    postsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredPosts = posts.filter(p => {
    if (activeTab === 'videos') return p.media_type === 'video';
    return true;
  });

  const getJoinDate = () => {
    if (user?.created_at) {
      const d = new Date(user.created_at);
      return `Joined ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="h-48 skeleton" />
          <div className="p-6 flex items-end gap-4 -mt-16">
            <div className="w-28 h-28 rounded-full skeleton border-4 border-surface-dark" />
            <div className="flex-1 space-y-2 pb-2">
              <div className="h-5 w-32 skeleton rounded" />
              <div className="h-3 w-48 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">User not found</h2>
          <Button onClick={() => navigate('/')}>Go to Feed</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      <div className="max-w-4xl mx-auto px-4 py-6 pb-20 md:pb-8">
        {/* Profile card with cover */}
        <div className="glass overflow-hidden mb-6">
          {/* Cover area */}
          <div className="h-44 md:h-56 relative overflow-hidden">
            {user.cover_url ? (
              <img
                src={user.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-card via-surface to-surface-dark">
                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 rounded-full blur-[80px]" />
                <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-neon-blue/5 rounded-full blur-[60px]" />
              </div>
            )}

            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Stats on cover */}
            <div className="absolute top-6 left-6 flex items-center gap-6">
              <button onClick={scrollToPosts} className="text-center hover:opacity-80 transition" title="Scroll to posts">
                <p className="text-2xl font-black text-neon-cyan drop-shadow-lg">{formatNumber(user.posts_count || 0)}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold">Posts</p>
              </button>
              <button onClick={() => setModalMode('followers')} className="text-center hover:opacity-80 transition">
                <p className="text-2xl font-black text-white drop-shadow-lg">{formatNumber(user.followers_count || 0)}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold">Followers</p>
              </button>
              <button onClick={() => setModalMode('following')} className="text-center hover:opacity-80 transition">
                <p className="text-2xl font-black text-white drop-shadow-lg">{formatNumber(user.following_count || 0)}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold">Following</p>
              </button>
            </div>

            {/* Follow button on cover */}
            <div className="absolute top-6 right-6">
              {isOwnProfile ? (
                <Button variant="secondary" size="sm" onClick={() => navigate('/settings/edit')}>
                  <Settings size={14} className="mr-1.5" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant={isFollowing ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={handleFollow}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  </motion.div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(
                      `/messages?userId=${user.id}&username=${encodeURIComponent(user.username)}&avatar=${encodeURIComponent(user.avatar_url || '')}`
                    )}
                  >
                    <MessageCircle size={14} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Avatar + info section */}
          <div className="px-6 pb-6 -mt-14">
            <motion.div
              variants={profileAvatarVariants}
              initial="hidden"
              animate="visible"
              className="mb-4"
            >
              <div className="relative inline-block">
                <Avatar
                  src={user.avatar_url}
                  alt={user.username}
                  size="xl"
                  className="w-28 h-28 border-4 border-surface-card"
                  hasStory={user.has_story}
                  isOnline={user.is_online}
                />
              </div>
            </motion.div>

            <motion.div
              variants={profileInfoVariants}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-2xl font-black text-white mb-1">{user.full_name || user.username}</h1>

              <p className="text-sm text-gray-500 mb-2">@{user.username}</p>

              {user.bio && (
                <p className="text-gray-400 text-sm leading-relaxed mb-3 max-w-lg">{user.bio}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500">
                {getJoinDate() && (
                  <span className="flex items-center gap-1"><Calendar size={12} /> {getJoinDate()}</span>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Gallery section */}
        <div ref={postsGridRef} className="flex items-center justify-between mb-4">
          <h2 className="section-label">Posts</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-card rounded-lg p-0.5 border border-white/[0.04]">
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'posts' ? 'bg-white/[0.08] text-white' : 'text-gray-500'
                }`}
              >
                <Grid size={14} /> All
              </button>
              <button
                onClick={() => setActiveTab('videos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'videos' ? 'bg-white/[0.08] text-white' : 'text-gray-500'
                }`}
              >
                <Film size={14} /> Videos
              </button>
            </div>

            <div className="flex bg-surface-card rounded-lg p-0.5 border border-white/[0.04]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-gray-500'}`}
              >
                <Grid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-gray-500'}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-500">
              {activeTab === 'videos' ? 'No videos yet' : 'No posts yet'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3"
          >
            {filteredPosts.map((post, i) => (
              <motion.div
                key={post.id}
                variants={gridItemVariants}
                whileHover={{ scale: 1.02 }}
                className={`bg-surface-card cursor-pointer relative group overflow-hidden rounded-xl ${
                  i === 0 && viewMode === 'grid' ? 'md:col-span-2 md:row-span-2' : ''
                } aspect-square`}
                onClick={() => navigate(`/post/${post.id}`)}
              >
                {post.media_type === 'video' ? (
                  <>
                    <video
                      src={post.image_url}
                      muted
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Play className="w-5 h-5 text-white drop-shadow-lg fill-white" />
                    </div>
                  </>
                ) : (
                  <img
                    src={post.image_url}
                    alt={post.caption || 'Post'}
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6">
                  <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
                    ❤️ {formatNumber(Number(post.likes_count) || 0)}
                  </span>
                  <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
                    💬 {formatNumber(Number(post.comments_count) || 0)}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {modalMode && (
        <FollowersModal
          userId={user.id}
          mode={modalMode}
          onClose={() => setModalMode(null)}
        />
      )}
    </motion.div>
  );
}