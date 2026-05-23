import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { fileToBase64 } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AvatarUpload } from '../components/profile/AvatarUpload';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { pageVariants } from '../lib/animations';
import toast from 'react-hot-toast';

export function EditProfile() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(user?.cover_url || null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = await api.updateProfile(formData);
      login(localStorage.getItem('token')!, { ...user!, ...updated });
      toast.success('Profile updated!');
      navigate(`/profile/${user?.username}`);
    } catch (error) {
      toast.error('Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Cover image must be under 8MB');
      return;
    }
    setIsCoverUploading(true);
    try {
      const base64 = await fileToBase64(file);
      setCoverPreview(base64);
      const data = await api.updateCover(base64);
      login(localStorage.getItem('token')!, { ...user!, cover_url: data.cover_url });
      toast.success('Cover image updated!');
    } catch {
      toast.error('Cover upload failed');
      setCoverPreview(user?.cover_url || null);
    } finally {
      setIsCoverUploading(false);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="max-w-2xl mx-auto p-4 pb-20"
    >
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div className="glass overflow-hidden">
        {/* Cover Image Section */}
        <div className="relative h-44 md:h-56 overflow-hidden group">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface-card via-surface to-surface-dark">
              <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-neon-blue/5 rounded-full blur-[60px]" />
            </div>
          )}
          {/* Cover upload overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isCoverUploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/60 backdrop-blur-sm rounded-xl text-white text-sm font-medium hover:bg-black/80 transition-all disabled:opacity-50"
            >
              {isCoverUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <ImagePlus size={18} />
                  {coverPreview ? 'Change Cover' : 'Add Cover Photo'}
                </>
              )}
            </button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverSelect}
          />
        </div>

        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>

          {/* Avatar */}
          <div className="flex justify-center mb-6 -mt-20">
            <AvatarUpload
              currentAvatar={user?.avatar_url}
              onUpdate={(url: string) => login(localStorage.getItem('token')!, { ...user!, avatar_url: url })}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="section-label mb-2 block">Username</label>
              <Input value={user?.username} disabled />
              <p className="text-[10px] text-gray-600 mt-1">Username cannot be changed</p>
            </div>

            <div>
              <label className="section-label mb-2 block">Full Name</label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                maxLength={80}
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className="section-label mb-2 block">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                maxLength={150}
                rows={4}
                placeholder="Tell people about yourself..."
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/30 resize-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/150</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">Save Changes</Button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}