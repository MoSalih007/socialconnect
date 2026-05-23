import { io, Socket } from 'socket.io-client';

// Client-side Socket.IO — real-time messaging, typing, presence, notifications

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

/**
 * Connect to Socket.IO server with JWT auth.
 * Call this after login with the access token.
 */
export function connectSocket(token: string): Socket {
  // Disconnect existing connection if any
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'], // prefer WS, fallback to polling
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    reconnectAttempts++;
    console.warn(`🔌 Socket error (attempt ${reconnectAttempts}/${MAX_RECONNECT}):`, err.message);
    // If auth fails, don't keep retrying
    if (err.message === 'Invalid token' || err.message === 'Account suspended') {
      socket?.disconnect();
    }
  });

  return socket;
}

/**
 * Get the current socket instance (may be null if not connected)
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect from Socket.IO server.
 * Call on logout.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ─── Room management ──────────────────────────────────────────────────────────

export function joinDMRoom(otherUserId: number): void {
  socket?.emit('join:dm', otherUserId);
}

export function leaveDMRoom(otherUserId: number): void {
  socket?.emit('leave:dm', otherUserId);
}

export function joinGroupRoom(groupId: number): void {
  socket?.emit('join:group', groupId);
}

export function leaveGroupRoom(groupId: number): void {
  socket?.emit('leave:group', groupId);
}

// ─── Typing indicators ───────────────────────────────────────────────────────

export function sendTypingDM(otherUserId: number): void {
  socket?.emit('typing:dm', otherUserId);
}

export function sendStopTypingDM(otherUserId: number): void {
  socket?.emit('stop-typing:dm', otherUserId);
}

export function sendTypingGroup(groupId: number): void {
  socket?.emit('typing:group', groupId);
}

export function sendStopTypingGroup(groupId: number): void {
  socket?.emit('stop-typing:group', groupId);
}

// ─── Read receipts ────────────────────────────────────────────────────────────

export function sendMessagesRead(otherUserId: number): void {
  socket?.emit('messages:read', otherUserId);
}

// ─── Event listeners (returns cleanup function) ───────────────────────────────

export function onNewMessage(callback: (message: any) => void): () => void {
  socket?.on('new:message', callback);
  return () => { socket?.off('new:message', callback); };
}

export function onNewGroupMessage(callback: (data: { groupId: number; message: any }) => void): () => void {
  socket?.on('new:group-message', callback);
  return () => { socket?.off('new:group-message', callback); };
}

export function onTypingDM(callback: (data: { userId: number; username: string }) => void): () => void {
  socket?.on('typing:dm', callback);
  return () => { socket?.off('typing:dm', callback); };
}

export function onStopTypingDM(callback: (data: { userId: number }) => void): () => void {
  socket?.on('stop-typing:dm', callback);
  return () => { socket?.off('stop-typing:dm', callback); };
}

export function onTypingGroup(callback: (data: { userId: number; username: string; groupId: number }) => void): () => void {
  socket?.on('typing:group', callback);
  return () => { socket?.off('typing:group', callback); };
}

export function onStopTypingGroup(callback: (data: { userId: number; groupId: number }) => void): () => void {
  socket?.on('stop-typing:group', callback);
  return () => { socket?.off('stop-typing:group', callback); };
}

export function onPresence(callback: (data: { userId: number; isOnline: boolean }) => void): () => void {
  socket?.on('presence', callback);
  return () => { socket?.off('presence', callback); };
}

export function onNotification(callback: (notification: any) => void): () => void {
  socket?.on('notification', callback);
  return () => { socket?.off('notification', callback); };
}

export function onMessagesRead(callback: (data: { userId: number; readBy: number }) => void): () => void {
  socket?.on('messages:read', callback);
  return () => { socket?.off('messages:read', callback); };
}
