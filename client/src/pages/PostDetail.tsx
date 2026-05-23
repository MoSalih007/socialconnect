import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { PostCard } from '../components/feed/PostCard';
import type { Post } from '../types';
 
export function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
 
  useEffect(() => {
    if (id) {
      api.getPost(parseInt(id))
        .then(setPost)
        .catch(() => navigate('/'))
        .finally(() => setIsLoading(false));
    }
  }, [id]);
 
  if (isLoading) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='skeleton rounded-2xl h-96' />
      </div>
    );
  }
 
  return (
    <div className='max-w-2xl mx-auto px-4 py-8'>
      <button onClick={() => navigate(-1)}
        className='flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors'>
        <ArrowLeft size={20} />
        Back
      </button>
      {post ? <PostCard post={post} /> : <p className='text-center text-gray-500'>Post not found</p>}
    </div>
  );
}
