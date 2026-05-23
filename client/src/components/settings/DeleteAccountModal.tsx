import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export function DeleteAccountModal({ isOpen, onClose }: any) {
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsDeleting(true);

    try {
      await api.deleteAccount(password);
      logout();
      navigate('/login');
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Account">
      <form onSubmit={handleDelete} className="space-y-4">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400 font-semibold mb-2">⚠️ Warning</p>
          <p className="text-sm text-gray-400">This action cannot be undone. All your posts, comments, and data will be permanently deleted.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Enter your password to confirm</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700">
            Delete Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}