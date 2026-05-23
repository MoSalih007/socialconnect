import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { globalRateLimit } from './middleware/rateLimiter';
import { notFound, errorHandler } from './middleware/errorHandler';
import pool from './config/db';
import { deleteFromCloudinary, processCloudinaryQueue } from './utils/cloudinary';

// ─── Validate critical env vars at startup ─────────────────────────────────
function validateEnvironment() {
  const errors: string[] = [];
  const required: Record<string, { minLength?: number; mustBeHex?: boolean }> = {
    JWT_SECRET: { minLength: 16 },
    AES_KEY: { minLength: 64, mustBeHex: true },
  };
  for (const [key, rules] of Object.entries(required)) {
    const val = process.env[key];
    if (!val) { errors.push(`Missing required env var: ${key}`); continue; }
    if (rules.minLength && val.length < rules.minLength) {
      errors.push(`${key} must be at least ${rules.minLength} chars (got ${val.length})`);
    }
    if (rules.mustBeHex && !/^[0-9a-fA-F]+$/.test(val)) {
      errors.push(`${key} must be valid hexadecimal`);
    }
  }
  // Warn (non-fatal) for optional vars
  const recommended = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
  for (const key of recommended) {
    if (!process.env[key]) console.warn(`⚠️  Missing recommended env var: ${key} — related features will fail`);
  }
  if (errors.length > 0) {
    console.error('\n🔴 FATAL — Invalid environment configuration:');
    errors.forEach(e => console.error('   •', e));
    console.error('\nServer cannot start with invalid configuration. Fix .env and restart.\n');
    process.exit(1);
  }
}
validateEnvironment();

// Import routes
import authRoutes from './routes/auth';
import passwordResetRoutes from './routes/passwordReset';
import postsRoutes from './routes/posts';
import usersRoutes from './routes/users';
import messagesRoutes from './routes/messages';
import storiesRoutes from './routes/stories';
import hashtagsRoutes from './routes/hashtags';
import reportsRoutes from './routes/reports';
import notificationsRoutes from './routes/notifications';
import savedPostsRoutes from './routes/savedPosts';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import suggestionsRoutes from './routes/suggestions';
import groupMessagesRoutes from './routes/groupMessages';
import reactionsRoutes from './routes/reactions';
import { initSocketServer } from './socket';

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy — only behind reverse proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
} else {
  app.set('trust proxy', false);
}

// Middleware
// Build allowed origins list (supports comma-separated FRONTEND_URL for dev)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(u => u.trim());

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.giphy.com'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
// Allow up to 75mb for base64-encoded video uploads (50MB video ≈ 67MB base64)
app.use(express.json({ limit: '75mb' }));
app.use(express.urlencoded({ extended: false }));
// Parse httpOnly cookies for refresh token reading
app.use(cookieParser());
app.use(globalRateLimit);

// Prevent caching of authenticated API responses (security: prevents back-button data leaks)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/hashtags', hashtagsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/saved-posts', savedPostsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/groups', groupMessagesRoutes);
app.use('/api/reactions', reactionsRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server with Socket.IO
const httpServer = createServer(app);
initSocketServer(httpServer, allowedOrigins);

const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.IO: ws://localhost:${PORT}`);

  // ─── Render.com keep-alive ping (prevents free-tier sleep) ────────────
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      fetch(`${process.env.RENDER_EXTERNAL_URL}/health`).catch(() => {});
    }, 14 * 60 * 1000); // Every 14 minutes
    console.log('🏓 Keep-alive ping enabled for Render');
  }

  // ─── Periodic cleanup of expired data ─────────────────────────────────
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // Every hour
  setInterval(async () => {
    try {
      // Delete expired stories + queue Cloudinary cleanup
      const expiredStories = await pool.query(
        `DELETE FROM stories WHERE expires_at < NOW() RETURNING image_url`
      );
      for (const story of expiredStories.rows) {
        if (story.image_url?.includes('res.cloudinary.com')) {
          deleteFromCloudinary(story.image_url);
        }
      }

      // Archive old notifications (keep 90 days)
      await pool.query(`DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`);

      // Clean up expired password reset tokens
      await pool.query(`DELETE FROM password_resets WHERE expires_at < NOW()`);

      // Clean up expired token blacklist entries
      await pool.query(`DELETE FROM token_blacklist WHERE expires_at < NOW()`).catch(() => {});

      // Clean up expired refresh tokens
      await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`).catch(() => {});

      // Process Cloudinary cleanup queue (retry failed deletions)
      const cloudinaryCleaned = await processCloudinaryQueue().catch(() => 0);

      if (expiredStories.rows.length > 0 || cloudinaryCleaned) {
        console.log(`🧹 Cleanup: ${expiredStories.rows.length} stories, ${cloudinaryCleaned} Cloudinary files`);
      }
    } catch (err) {
      console.error('Cleanup job error (non-fatal):', err);
    }
  }, CLEANUP_INTERVAL);
});

// Graceful shutdown with timeout
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds max

function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit if connections don't close in time
  setTimeout(() => {
    console.error('Forced shutdown — connections did not close in time');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled errors to prevent process crashes
process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ Unhandled Promise Rejection:', reason?.message || reason);
  // Don't crash — log and continue (most are non-fatal DB/network errors)
});

process.on('uncaughtException', (error: Error) => {
  console.error('🔴 Uncaught Exception:', error.message);
  // For truly fatal errors, attempt graceful shutdown
  if (error.message.includes('EADDRINUSE') || error.message.includes('out of memory')) {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
  // Otherwise keep running — the error handler middleware catches most request errors
});