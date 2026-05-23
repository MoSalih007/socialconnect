import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../types';

// Check if a JWT token is expired by decoding the payload
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // If we can't decode it, treat it as expired
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user, isAuthenticated: true });
        // Connect Socket.IO on login
        connectSocket(token);
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        // Disconnect Socket.IO on logout
        disconnectSocket();
        set({ token: null, user: null, isAuthenticated: false });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      // Persist token + user for seamless page refresh experience.
      // Security note: is_admin is ALWAYS server-enforced — local manipulation
      // only affects client UI, not actual permissions.
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

// Auto-logout stale sessions on app load
const { token: existingToken, logout: autoLogout } = useAuthStore.getState();
if (existingToken && isTokenExpired(existingToken)) {
  autoLogout();
} else if (existingToken) {
  // Auto-connect Socket.IO for existing sessions
  connectSocket(existingToken);
}