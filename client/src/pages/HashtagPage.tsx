import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { PostCard } from '../components/feed/PostCard';
import { motion } from 'framer-motion';
import { pageVariants } from '../lib/animations';

export function HashtagPage() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadPosts(); }, [tag]);

  const loadPosts = async () => {
    try { const data = await api.getHashtagPosts(tag!); setPosts(data); }
    catch { console.error('Failed to load posts'); }
    finally { setIsLoading(false); }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-black text-white mb-1">
        <span className="text-neon-cyan">#</span>{tag}
      </h1>
      <p className="text-sm text-gray-500 mb-6">Posts tagged with #{tag}</p>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="skeleton rounded-2xl h-96" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No posts yet</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => <PostCard key={post.id} post={post} />)}
        </div>
      )}
    </motion.div>
  );
}