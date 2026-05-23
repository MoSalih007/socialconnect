import { create } from 'zustand';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface NotificationState {
  unreadCount: number;
  previousCount: number;
  polling: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  fetchUnreadCount: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  previousCount: 0,
  polling: false,
  intervalId: null,

  fetchUnreadCount: async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      const newCount = data.count ?? 0;
      const prevCount = get().previousCount;

      // Show a live toast when new notifications arrive (Instagram-style)
      if (newCount > prevCount && prevCount >= 0 && get().polling) {
        const diff = newCount - prevCount;
        toast(
          `You have ${diff} new notification${diff > 1 ? 's' : ''}`,
          {
            icon: '🔔',
            duration: 3000,
            style: {
              background: 'var(--color-surface-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid rgba(0, 255, 209, 0.2)',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 0 20px rgba(0, 255, 209, 0.1)',
            },
          }
        );
      }

      set({ unreadCount: newCount, previousCount: newCount });
    } catch {
      // Silently fail — don't break the UI if the endpoint isn't available
    }
  },

  startPolling: () => {
    const state = get();
    if (state.polling) return;

    // Fetch immediately
    state.fetchUnreadCount();

    // Then every 15 seconds for a more "live" feel
    const intervalId = setInterval(() => {
      get().fetchUnreadCount();
    }, 15_000);

    set({ polling: true, intervalId });
  },

  stopPolling: () => {
    const state = get();
    if (state.intervalId) clearInterval(state.intervalId);
    set({ polling: false, intervalId: null });
  },

  reset: () => {
    const state = get();
    if (state.intervalId) clearInterval(state.intervalId);
    set({ unreadCount: 0, previousCount: 0, polling: false, intervalId: null });
  },
}));
