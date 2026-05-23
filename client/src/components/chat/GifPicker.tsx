import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp } from 'lucide-react';

interface GifPickerProps {
    onSelect: (gifUrl: string) => void;
    onClose: () => void;
}

// Uses the free Klipy API
// Add VITE_KLIPY_API_KEY to your client .env file
// Get a free key at: https://klipy.com (sign up → dashboard → API key)
//
// WHY KLIPY OVER GIPHY?
// ✅ Lifetime free — unlimited API calls in production
// ✅ GIFs + Stickers + Clips + Memes (more content types)
// ✅ Built by ex-Tenor (Google) team
// ✅ Revenue sharing via optional ads
// ❌ Giphy now has 100 calls/hour free limit, paid plans start ~$9,000/year
const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY || '';

interface KlipyGif {
    id: string;
    title: string;
    content_urls: {
        gif: { url: string; dims: [number, number] };
        tinygif: { url: string; dims: [number, number] };
        m{ url: string; dims: [number, number] };
    };
}

interface KlipyResponse {
    results: KlipyGif[];
    next: string;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<KlipyGif[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus search on open
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Load trending GIFs on mount
    useEffect(() => {
        if (!KLIPY_API_KEY) {
            setError('Klipy API key not configured. Add VITE_KLIPY_API_KEY to your .env file.');
            return;
        }
        loadTrending();
    }, []);

    // Search with debounce
    useEffect(() => {
        if (!query.trim()) {
            loadTrending();
            return;
        }

        const timer = setTimeout(() => {
            searchGifs(query.trim());
        }, 400);

        return () => clearTimeout(timer);
    }, [query]);

    const loadTrending = async () => {
        if (!KLIPY_API_KEY) return;
        setLoading(true);
        try {
            const res = await fetch(
                `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/trending?limit=30`
            );
            const data: KlipyResponse = await res.json();
            setGifs(data.results || []);
            setError('');
        } catch {
            setError('Failed to load GIFs');
        } finally {
            setLoading(false);
        }
    };

    const searchGifs = async (searchQuery: string) => {
        if (!KLIPY_API_KEY) return;
        setLoading(true);
        try {
            const res = await fetch(
                `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(searchQuery)}&limit=30`
            );
            const data: KlipyResponse = await res.json();
            setGifs(data.results || []);
            setError('');
        } catch {
            setError('Failed to search GIFs');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (gif: KlipyGif) => {
        // Use the standard gif URL for display
        const url = gif.content_urls?.gif?.url || gif.content_urls?.tinygif?.url;
        if (url) {
            onSelect(url);
        }
    };

    // Get aspect ratio for proper grid sizing
    const getAspectPadding = (gif: KlipyGif): string => {
        const dims = gif.content_urls?.gif?.dims || gif.content_urls?.tinygif?.dims;
        if (dims && dims[0] > 0) {
            return `${(dims[1] / dims[0]) * 100}%`;
        }
        return '75%'; // default fallback
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{ height: '380px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">GIF</span>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search GIFs..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
            </div>

            {/* GIF Grid */}
            <div className="overflow-y-auto px-2 pb-2" style={{ height: 'calc(100% - 115px)' }}>
                {error && (
                    <p className="text-center text-red-500 text-sm py-8">{error}</p>
                )}
                {loading && (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                {!loading && !error && gifs.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">No GIFs found</p>
                )}
                {!loading && !error && (
                    <div className="grid grid-cols-2 gap-1">
                        {gifs.map((gif) => (
                            <button
                                key={gif.id}
                                type="button"
                                onClick={() => handleSelect(gif)}
                                className="relative overflow-hidden rounded-lg hover:opacity-80 transition group"
                                style={{ paddingBottom: getAspectPadding(gif) }}
                            >
                                <img
                                    src={gif.content_urls?.tinygif?.url || gif.content_urls?.gif?.url}
                                    alt={gif.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    loading="lazy"
                                />
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Powered by Klipy */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm text-center py-1">
                <span className="text-xs text-gray-400">Powered by Klipy</span>
            </div>
        </div>
    );
}
