import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Search as SearchIcon, TrendingUp, Clock, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { pageVariants, listVariants, listItemVariants } from '../lib/animations';
import toast from 'react-hot-toast';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ users: [], hashtags: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    api.getTrendingHashtags().then(setTrending).catch(() => {});
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults({ users: [], hashtags: [] }); setIsLoading(false); return; }
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.search(query);
        setResults(data);
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      } catch { toast.error('Search failed'); }
      finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const clearRecent = () => { setRecentSearches([]); localStorage.removeItem('recentSearches'); };
  const hasResults = results.users.length > 0 || results.hashtags.length > 0;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
      {/* Search bar */}
      <motion.div className="mb-6" animate={isFocused ? { scale: 1.01 } : { scale: 1 }} transition={{ duration: 0.2 }}>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search users, hashtags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full pl-12 pr-10 py-3.5 bg-black/40 border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/30 transition-all shadow-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/[0.06] transition">
              <X size={16} className="text-gray-500" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="w-12 h-12 rounded-full skeleton" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 skeleton rounded" />
                <div className="h-2 w-20 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && hasResults && (
        <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-6">
          {results.users.length > 0 && (
            <div>
              <h2 className="section-label mb-3 px-1">Users</h2>
              <div className="space-y-1">
                {results.users.map((user: any) => (
                  <motion.div key={user.id} variants={listItemVariants}>
                    <Link to={`/profile/${user.username}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                      <Avatar src={user.avatar_url} alt={user.username} size="md" />
                      <div>
                        <p className="font-semibold text-sm text-white">{user.username}</p>
                        {user.full_name && <p className="text-sm text-gray-500">{user.full_name}</p>}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {results.hashtags.length > 0 && (
            <div>
              <h2 className="section-label mb-3 px-1">Hashtags</h2>
              <div className="space-y-1">
                {results.hashtags.map((hashtag: any) => (
                  <motion.div key={hashtag.tag} variants={listItemVariants}>
                    <Link to={`/hashtag/${hashtag.tag}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-neon-cyan/10 flex items-center justify-center text-lg font-bold text-neon-cyan">#</div>
                      <div>
                        <p className="font-semibold text-sm text-white">#{hashtag.tag}</p>
                        <p className="text-xs text-gray-500">{hashtag.post_count} posts</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* No results */}
      {!isLoading && query && !hasResults && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface-card flex items-center justify-center">
            <SearchIcon className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-400 font-medium">No results found</p>
          <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
        </motion.div>
      )}

      {/* Empty state */}
      {!query && !isLoading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="section-label flex items-center gap-1.5"><Clock size={14} /> Recent</h3>
                <button onClick={clearRecent} className="text-xs text-neon-cyan hover:underline font-medium">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button key={term} onClick={() => setQuery(term)} className="px-3 py-1.5 text-sm bg-surface-card border border-white/[0.04] hover:bg-white/[0.06] rounded-full transition-colors text-gray-300">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {trending.length > 0 && (
            <div>
              <h3 className="section-label flex items-center gap-1.5 mb-3 px-1"><TrendingUp size={14} /> Trending</h3>
              <div className="space-y-1">
                {trending.map((tag: any, i: number) => (
                  <motion.div key={tag.tag} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link to={`/hashtag/${tag.tag}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                        <TrendingUp size={16} className="text-neon-cyan" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">#{tag.tag}</p>
                        <p className="text-xs text-gray-500">{tag.post_count} posts</p>
                      </div>
                      <span className="ml-auto text-xs font-bold text-gray-500">#{i + 1}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}