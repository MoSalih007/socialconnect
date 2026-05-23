import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, X, ImagePlus, MapPin, Users, Hash } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { fileToBase64 } from '../lib/utils';
import { pageVariants } from '../lib/animations';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function CreatePost() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isDragOver, setIsDragOver] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = (selected: File) => {
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 10MB');
      return;
    }

    const isVideo = selected.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) { toast.error('Please select an image or video'); return; }
    setIsUploading(true);
    try {
      // Convert file to base64 for the server
      const base64 = await fileToBase64(file);
      
      const body: Record<string, string> = {};
      if (mediaType === 'video') {
        body.video_base64 = base64;
      } else {
        // Client-side image optimization before upload
        const optimized = await optimizeImage(base64);
        body.image_base64 = optimized;
      }
      if (caption.trim()) body.caption = caption.trim();

      await api.createPost(body);
      toast.success('Post published! 🎉');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const optimizeImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1920;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob!);
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(base64); // fallback to original
    });
  };

  const clearFile = () => {
    setFile(null);
    setPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-[80vh] flex items-start justify-center px-4 py-8"
    >
      <div className="glass max-w-xl w-full p-6 md:p-8 shadow-card-glow relative overflow-hidden">
        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Create Post</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Share a photo or video with your followers</p>
        </div>

        {/* Upload area */}
        {!preview ? (
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer group transition-all duration-300 ${
              isDragOver 
                ? 'border-neon-cyan/50 bg-neon-cyan/5' 
                : 'border-white/10 hover:border-neon-cyan/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <motion.div
              animate={isDragOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center group-hover:bg-neon-cyan/10 transition-colors"
            >
              <ImagePlus className="w-8 h-8 text-gray-500 group-hover:text-neon-cyan transition-colors" />
            </motion.div>
            <p className="text-gray-400 text-sm mb-2">Drag & Drop your media here</p>
            <p className="text-gray-600 text-xs mb-4">or</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="btn-primary !py-2 !px-5 !text-xs"
            >
              Select from Device
            </button>
            <p className="text-gray-600 text-[10px] mt-4">JPEG, PNG, WebP, MP4 · Max 10MB</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden mb-4 group">
            {mediaType === 'video' ? (
              <video src={preview} controls className="w-full max-h-[400px] object-contain bg-black rounded-2xl" />
            ) : (
              <img src={preview} alt="Preview" className="w-full max-h-[400px] object-contain bg-surface rounded-2xl" />
            )}
            <button
              onClick={clearFile}
              className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-red-500/80 transition-all group"
              title="Remove"
            >
              <X size={16} />
            </button>
            {/* Media type badge */}
            <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
              mediaType === 'video' 
                ? 'bg-purple-500/80 text-white' 
                : 'bg-neon-cyan/80 text-surface-dark'
            }`}>
              {mediaType === 'video' ? '🎬 Video' : '📷 Photo'}
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Caption area */}
        <div className="mt-5">
          <p className="section-label mb-2">Caption</p>
          <textarea
            ref={captionRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            rows={3}
            maxLength={2000}
            className="w-full px-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 resize-none transition-all"
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-[10px] text-gray-600">Use #hashtags to reach more people</p>
            <span className="text-[10px] text-gray-600">{caption.length}/2000</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setShowLocationInput(!showLocationInput)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all border ${
              showLocationInput || location
                ? 'bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan'
                : 'bg-white/[0.03] border-white/[0.04] text-gray-400 hover:bg-white/[0.06]'
            }`}
          >
            <MapPin size={14} />
            {location || 'Add Location'}
          </button>
          <button
            type="button"
            onClick={() => setShowTagInput(!showTagInput)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all border ${
              showTagInput || taggedUsers
                ? 'bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan'
                : 'bg-white/[0.03] border-white/[0.04] text-gray-400 hover:bg-white/[0.06]'
            }`}
          >
            <Users size={14} />
            {taggedUsers || 'Tag People'}
          </button>
          <button
            type="button"
            onClick={() => {
              const ta = captionRef.current;
              if (ta) {
                const pos = ta.selectionStart ?? caption.length;
                const newCaption = caption.slice(0, pos) + '#' + caption.slice(pos);
                setCaption(newCaption);
                setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + 1, pos + 1); }, 0);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04] text-xs text-gray-400 hover:bg-white/[0.06] transition-all"
          >
            <Hash size={14} /> Add Hashtag
          </button>
        </div>

        {/* Location input */}
        {showLocationInput && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-neon-cyan shrink-0" />
              <input
                type="text"
                placeholder="Enter location (e.g. New York, NY)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                className="flex-1 px-3 py-2 bg-black/40 border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
              />
              {location && (
                <button onClick={() => { setLocation(''); setShowLocationInput(false); }} className="p-1 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Tag People input */}
        {showTagInput && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-neon-cyan shrink-0" />
              <input
                type="text"
                placeholder="Enter usernames (comma separated)"
                value={taggedUsers}
                onChange={(e) => setTaggedUsers(e.target.value)}
                maxLength={200}
                className="flex-1 px-3 py-2 bg-black/40 border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all"
              />
              {taggedUsers && (
                <button onClick={() => { setTaggedUsers(''); setShowTagInput(false); }} className="p-1 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="!text-gray-400">
              Cancel
            </Button>
          </div>
          <Button
            onClick={handleSubmit}
            isLoading={isUploading}
            disabled={!file}
            className="!px-8"
          >
            <Upload size={16} className="mr-2" />
            Publish Post
          </Button>
        </div>
      </div>
    </motion.div>
  );
}