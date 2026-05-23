import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiter';
import { sendPasswordResetEmail } from '../utils/emailService';

const router = Router();

/**
 * Hash a reset token before storing it in the database.
 * This way, if the DB is compromised, attackers cannot use raw tokens.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/password-reset/request
router.post('/request', authRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.json({ message: 'If an account exists, password reset link will be sent' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success (don't reveal if user exists)
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists, password reset link will be sent' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate all existing tokens for this user before creating a new one
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    // Send the UNHASHED token in the email (user needs the raw token)
    await sendPasswordResetEmail(user.email, user.username, resetToken);

    res.json({ message: 'If an account exists, password reset link will be sent' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Request failed' });
  }
});

// POST /api/password-reset/verify
router.post('/verify', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Token required' });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await pool.query(
      'SELECT id FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

// POST /api/password-reset/reset
router.post('/reset', passwordResetRateLimit, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({ message: 'Password must be 8+ chars with uppercase, lowercase, and number' });
  }

  try {
    const tokenHash = hashToken(token);
    const resetResult = await pool.query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
      [tokenHash]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const userId = resetResult.rows[0].user_id;
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password_hash = $1, must_reset_password = false WHERE id = $2', [passwordHash, userId]);

    // Invalidate ALL reset tokens for this user (prevents replay attacks)
    await pool.query('UPDATE password_resets SET used = true WHERE user_id = $1', [userId]);

    res.json({ message: 'Password reset successful!' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Reset failed' });
  }
});

export default router;