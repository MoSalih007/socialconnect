import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db';

export interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

// In-memory ban cache: userId -> { banned: boolean, mustReset: boolean, checkedAt: timestamp }
export const banCache = new Map<number, { banned: boolean; mustReset: boolean; checkedAt: number }>();
const BAN_CACHE_TTL = 60_000; // Re-check every 60 seconds

// In-memory blacklist cache (avoids DB hit on every request for recently-blacklisted tokens)
const blacklistCache = new Set<string>();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as { id: number; email: string };

    // Check token blacklist (logout invalidation)
    const tokenHash = hashToken(token);
    if (blacklistCache.has(tokenHash)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }
    const blacklisted = await pool.query(
      'SELECT 1 FROM token_blacklist WHERE token_hash = $1',
      [tokenHash]
    ).catch(() => ({ rows: [] })); // Non-fatal: if table doesn't exist yet, skip
    if (blacklisted.rows.length > 0) {
      blacklistCache.add(tokenHash); // Cache for future requests
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    // Check ban + must_reset status (cached) — FAIL CLOSED: deny access if DB check fails
    const cached = banCache.get(decoded.id);
    const now = Date.now();
    if (!cached || now - cached.checkedAt > BAN_CACHE_TTL) {
      try {
        const result = await pool.query('SELECT is_banned, must_reset_password FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) {
          // User no longer exists — deny access
          return res.status(401).json({ message: 'Account not found' });
        }
        const isBanned = result.rows[0].is_banned === true;
        const mustReset = result.rows[0].must_reset_password === true;
        banCache.set(decoded.id, { banned: isBanned, mustReset, checkedAt: now });
        if (isBanned) {
          return res.status(403).json({ message: 'Your account has been suspended.' });
        }
        // Enforce must_reset_password on active sessions
        // Exempt password reset and logout endpoints so user can still perform the reset
        // Use req.originalUrl to match regardless of router mount point
        const exemptPatterns = ['/password-reset/reset', '/password-reset/request', '/password-reset/verify', '/auth/logout'];
        if (mustReset && !exemptPatterns.some(p => req.originalUrl.includes(p))) {
          return res.status(403).json({
            message: 'Password reset required',
            code: 'MUST_RESET_PASSWORD'
          });
        }
      } catch {
        // SECURITY: Fail closed — if we can't verify ban status, deny the request
        // This prevents banned users from accessing the app during DB outages
        return res.status(503).json({ message: 'Service temporarily unavailable. Please try again.' });
      }
    } else if (cached.banned) {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    } else if (cached.mustReset) {
      const exemptPatterns = ['/password-reset/reset', '/password-reset/request', '/password-reset/verify', '/auth/logout'];
      if (!exemptPatterns.some(p => req.originalUrl.includes(p))) {
        return res.status(403).json({ message: 'Password reset required', code: 'MUST_RESET_PASSWORD' });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}