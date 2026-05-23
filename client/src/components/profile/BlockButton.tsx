import { useState } from 'react';
import { Ban, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';

export function BlockButton({ userId, isBlocked: initialBlocked }: any) {
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [isLoading, setIsLoading] = useState(false);

  const toggleBlock = async () => {
    setIsLoading(true);
    try {
      if (isBlocked) {
        await api.unblockUser(userId);
        setIsBlocked(false);
      } else {
        await api.blockUser(userId);
        setIsBlocked(true);
      }
    } catch (error) {
      alert('Failed to ' + (isBlocked ? 'unblock' : 'block'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={toggleBlock}
      isLoading={isLoading}
      variant={isBlocked ? 'secondary' : 'danger'}
      className="gap-2"
    >
      {isBlocked ? (
        <>
          <Check className="w-4 h-4" />
          Unblock
        </>
      ) : (
        <>
          <Ban className="w-4 h-4" />
          Block
        </>
      )}
    </Button>
  );
}