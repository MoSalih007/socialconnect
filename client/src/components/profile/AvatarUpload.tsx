import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { fileToBase64 } from '../../lib/utils';
import { api } from '../../lib/api';

export function AvatarUpload({ currentAvatar, onUpdate }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    const base64 = await fileToBase64(file);
    setPreview(base64);
    setIsOpen(true);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setIsUploading(true);
    try {
      const data = await api.updateAvatar(preview);
      onUpdate(data.avatar_url);
      setIsOpen(false);
    } catch { alert('Upload failed'); }
    finally { setIsUploading(false); }
  };

  return (
    <>
      <div className="relative inline-block">
        <Avatar src={currentAvatar} size="xl" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-1 right-1 p-2 rounded-full text-surface-dark transition-all hover:shadow-neon-sm"
          style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
        >
          <Camera className="w-4 h-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Upload Picture">
        <div className="space-y-4">
          {preview && <img src={preview} className="w-64 h-64 object-cover rounded-full mx-auto ring-4 ring-surface-card" />}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleUpload} isLoading={isUploading} className="flex-1">Upload</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}