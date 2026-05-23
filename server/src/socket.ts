import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './config/db';

// Socket.IO real-time messaging server
// Handles: live messages, typing indicators, online presence, notifications

interface AuthSocket extends Socket {
  userId?: number;
  username?: string;
}

// Map userId -> Set of socket IDs (a user can have multiple tabs open)
const onlineUsers = new Map<number, Set<string>>();

let io: Server;

export function getIO(): Server {
  return io;
}

export function initSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT authentication middleware for Socket.IO
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        algorithms: ['HS256'],
      }) as { id: number; email: string };

      // Check if user is banned
      const userResult = await pool.query(
        'SELECT id, username, is_banned FROM users WHERE id = $1',
        [decoded.id]
      );
      if (!userResult.rows[0] || userResult.rows[0].is_banned) {
        return next(new Error('Account suspended'));
      }

      socket.userId = decoded.id;
      socket.username = userResult.rows[0].username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Update online status in DB
    pool.query(
      'UPDATE users SET is_online = true, last_seen = NOW() WHERE id = $1',
      [userId]
    ).catch(() => {});

    // Broadcast online status to relevant users (followers)
    broadcastPresence(userId, true);

    console.log(`🔌 ${username} connected (${onlineUsers.get(userId)!.size} tabs)`);

    // ─── Join conversation rooms ──────────────────────────────────────────
    socket.on('join:dm', (otherUserId: number) => {
      if (typeof otherUserId !== 'number') return;
      const roomId = getDMRoom(userId, otherUserId);
      socket.join(roomId);
    });

    socket.on('join:group', (groupId: number) => {
      if (typeof groupId !== 'number') return;
      socket.join(`group:${groupId}`);
    });

    socket.on('leave:dm', (otherUserId: number) => {
      if (typeof otherUserId !== 'number') return;
      socket.leave(getDMRoom(userId, otherUserId));
    });

    socket.on('leave:group', (groupId: number) => {
      if (typeof groupId !== 'number') return;
      socket.leave(`group:${groupId}`);
    });

    // ─── Typing indicators ────────────────────────────────────────────────
    socket.on('typing:dm', (otherUserId: number) => {
      if (typeof otherUserId !== 'number') return;
      const room = getDMRoom(userId, otherUserId);
      socket.to(room).emit('typing:dm', { userId, username });
    });

    socket.on('typing:group', (groupId: number) => {
      if (typeof groupId !== 'number') return;
      socket.to(`group:${groupId}`).emit('typing:group', { userId, username, groupId });
    });

    socket.on('stop-typing:dm', (otherUserId: number) => {
      if (typeof otherUserId !== 'number') return;
      const room = getDMRoom(userId, otherUserId);
      socket.to(room).emit('stop-typing:dm', { userId });
    });

    socket.on('stop-typing:group', (groupId: number) => {
      if (typeof groupId !== 'number') return;
      socket.to(`group:${groupId}`).emit('stop-typing:group', { userId, groupId });
    });

    // ─── Mark messages as read ────────────────────────────────────────────
    socket.on('messages:read', (otherUserId: number) => {
      if (typeof otherUserId !== 'number') return;
      const room = getDMRoom(userId, otherUserId);
      socket.to(room).emit('messages:read', { userId, readBy: userId });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // Update last_seen
          pool.query(
            'UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1',
            [userId]
          ).catch(() => {});
          broadcastPresence(userId, false);
        }
      }
      console.log(`🔌 ${username} disconnected`);
    });
  });

  return io;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function getDMRoom(userA: number, userB: number): string {
  const sorted = [userA, userB].sort((a, b) => a - b);
  return `dm:${sorted[0]}-${sorted[1]}`;
}

async function broadcastPresence(userId: number, isOnline: boolean) {
  try {
    // Broadcast to followers who are currently connected
    const followers = await pool.query(
      'SELECT follower_id FROM follows WHERE following_id = $1',
      [userId]
    );
    for (const f of followers.rows) {
      const followerSockets = onlineUsers.get(f.follower_id);
      if (followerSockets) {
        for (const socketId of followerSockets) {
          io.to(socketId).emit('presence', { userId, isOnline });
        }
      }
    }
  } catch { /* non-fatal */ }
}

// ─── Public API for emitting events from routes ─────────────────────────────

/** Emit a new message to a DM room */
export function emitDMMessage(senderId: number, receiverId: number, message: any) {
  if (!io) return;
  const room = getDMRoom(senderId, receiverId);
  io.to(room).emit('new:message', message);
}

/** Emit a new message to a group room */
export function emitGroupMessage(groupId: number, message: any) {
  if (!io) return;
  io.to(`group:${groupId}`).emit('new:group-message', { groupId, message });
}

/** Emit a notification to a specific user */
export function emitNotification(userId: number, notification: any) {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit('notification', notification);
    }
  }
}

/** Check if a user is online (from server-side) */
export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size || 0) > 0;
}
