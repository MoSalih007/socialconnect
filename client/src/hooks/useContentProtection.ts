import { useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface ProtectionOptions {
  postId: number;
  ownerIsPrivate: boolean;
  isOwnPost: boolean;
}

export function useContentProtection({ postId, ownerIsPrivate, isOwnPost }: ProtectionOptions) {
  const handleScreenshotAttempt = useCallback(async () => {
    if (isOwnPost) return;

    if (ownerIsPrivate) {
      // Private: send permission request
      try {
        const result = await api.requestScreenshot(postId);
        if (result.status === 'granted') {
          const mins = Math.ceil((new Date(result.granted_until).getTime() - Date.now()) / 60000);
          toast.success(`Screenshot allowed for ${mins} minutes`, { icon: '📸', duration: 4000 });
        } else if (result.status === 'pending') {
          toast('Screenshot request sent to account owner.\nWaiting for approval...', {
            icon: '🔒',
            duration: 5000,
            style: { textAlign: 'center' },
          });
        }
      } catch (error: any) {
        if (error.status === 403) {
          const msg = error.blocked_until
            ? `Screenshot declined. Try again after ${new Date(error.blocked_until).toLocaleTimeString()}`
            : 'Screenshot request was declined';
          toast.error(msg, { icon: '🚫', duration: 4000 });
        } else if (error.status === 429) {
          toast.error('Too many requests. Please wait before trying again.', { icon: '⚠️' });
        }
      }
    } else {
      // Public: silently log + light toast
      api.reportScreenshot(postId).catch(() => {});
      toast('Screenshot noticed — owner will be notified', { icon: '📸', duration: 2000 });
    }
  }, [postId, ownerIsPrivate, isOwnPost]);

  useEffect(() => {
    if (isOwnPost) return;

    // Detect PrintScreen key and Mac screenshot shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
      ) {
        e.preventDefault();
        handleScreenshotAttempt();
      }
    };

    // Disable right-click save on protected images
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('[data-protected]')) {
        e.preventDefault();
        if (ownerIsPrivate) {
          handleScreenshotAttempt();
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isOwnPost, ownerIsPrivate, handleScreenshotAttempt]);
}
