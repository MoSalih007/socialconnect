import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db';
import { authRateLimit, resendVerificationRateLimit } from '../middleware/rateLimiter';
import { validateRegistration, handleValidationErrors } from '../middleware/validator';
import { sendVerificationEmail, send2FACodeEmail } from '../utils/emailService';
import { AuthRequest, verifyToken, banCache } from '../middleware/auth';

// Generate a 6-digit OTP code
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const router = Router();

// Hash tokens before storage
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate a cryptographically secure refresh token
function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

// Cookie options for httpOnly token storage
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const ACCESS_TOKEN_EXPIRY = '1h'; // Short-lived
const REFRESH_TOKEN_DAYS = 7;     // Long-lived

// POST /api/auth/register - Register new user
router.post('/register', authRateLimit, validateRegistration, handleValidationErrors, async (req: Request, res: Response) => {
  const { username, email, password, full_name } = req.body;

  try {
    // Check if user exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Hash the verification token before storing
    const tokenHash = hashToken(verificationToken);

    // Create user — store HASHED token, send RAW token in email
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash, full_name || null, tokenHash, tokenExpires]
    );

    // Send verification email (non-blocking — don't fail registration if email fails)
    try {
      await sendVerificationEmail(email, username, verificationToken);
    } catch (emailErr) {
      console.error('Verification email failed (user can resend):', emailErr);
    }

    res.status(201).json({
      message: 'Registration successful! Check your email to verify your account.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// GET /api/auth/verify-email?token=xxx - Verify email
router.get('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Token required' });
  }

  try {
    // Hash the incoming token to compare against stored hash
    const tokenHash = hashToken(token as string);
    const result = await pool.query(
      'SELECT id FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    await pool.query(
      'UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Input validation — prevent crashes from non-string input
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash, is_verified, is_admin, is_banned, must_reset_password, full_name, bio, avatar_url, is_private, show_online_status, show_last_seen, two_fa_enabled FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if user is banned
    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support for assistance.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in',
        requiresVerification: true
      });
    }

    // Check if admin forced a password reset
    if (user.must_reset_password) {
      // Still verify password first
      const pwMatch = await bcrypt.compare(password, user.password_hash);
      if (!pwMatch) return res.status(401).json({ message: 'Invalid credentials' });
      return res.status(403).json({
        message: 'Your password must be reset. Please use the "Forgot Password" link.',
        mustResetPassword: true
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2FA: If user has 2FA enabled, send OTP and return early
    if (user.two_fa_enabled) {
      const otpCode = generateOTPCode();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await pool.query(
        'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
        [otpCode, otpExpires, user.id]
      );

      // Send OTP email (non-blocking for login UX)
      try {
        await send2FACodeEmail(user.email, user.username, otpCode);
      } catch (emailErr) {
        console.error('2FA email failed:', emailErr);
        return res.status(500).json({ message: 'Failed to send verification code. Try again.' });
      }

      return res.json({
        requires2FA: true,
        email: user.email,
        message: 'Verification code sent to your email',
      });
    }

    // Generate short-lived access token (1h) + long-lived refresh token (7d)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'] || 'unknown';

    // Store hashed refresh token + device_token for fallback identification
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, hashToken(refreshToken), deviceInfo, refreshExpires]
    ).then(async (rtResult) => {
      // Link device session with device_token for fingerprint-independent identification
      if (rtResult.rows[0]) {
        await pool.query(
          `INSERT INTO device_sessions (user_id, device_info, fingerprint, last_active)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, fingerprint) DO UPDATE SET last_active = NOW(), is_active = true`,
          [user.id, deviceInfo, deviceInfo]
        ).catch(() => {});
      }
    }).catch(() => {}); // Non-fatal

    // Invalidate any pending password reset tokens on successful login
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    ).catch(() => {});

    const { password_hash, ...userWithoutPassword } = user;

    // Set tokens as httpOnly cookies (XSS-safe)
    res.cookie('access_token', token, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 }); // 1h
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });

    // Also return token in body for backwards compatibility with existing frontend
    res.json({
      token,
      refreshToken,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
// Dedicated rate limiter. Never reveal if email is verified or exists.
router.post('/resend-verification', resendVerificationRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.json({ message: 'If an account exists, verification email will be sent' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, is_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return the same generic response — never reveal if email exists or is verified
    if (result.rows.length === 0 || result.rows[0].is_verified) {
      return res.json({ message: 'If an account exists, verification email will be sent' });
    }

    const user = result.rows[0];
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(verificationToken);
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [tokenHash, tokenExpires, user.id]
    );

    await sendVerificationEmail(user.email, user.username, verificationToken);

    res.json({ message: 'If an account exists, verification email will be sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Failed to resend verification' });
  }
});

// ─── Logout endpoint — blacklist access token + delete refresh token ───────
router.post('/logout', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.json({ success: true });

    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Blacklist the access token
    await pool.query(
      `INSERT INTO token_blacklist (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [hashToken(token), req.user!.id, expiresAt]
    ).catch(() => {});

    // Delete all refresh tokens for this user (full logout)
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user!.id]).catch(() => {});

    banCache.delete(req.user!.id);

    // Clear httpOnly cookies
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.json({ success: true });
  }
});

// ─── Refresh token endpoint — rotate access + refresh tokens ───────────────
router.post('/refresh', async (req: Request, res: Response) => {
  // Accept refresh token from cookie OR body
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const result = await pool.query(
      `SELECT rt.id, rt.user_id, u.is_banned, u.email
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const { id: oldTokenId, user_id, is_banned, email } = result.rows[0];

    if (is_banned) {
      // Delete all tokens for banned user
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user_id]);
      return res.status(403).json({ message: 'Account suspended' });
    }

    // Rotate: delete old refresh token, create new one
    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [oldTokenId]);

    const newAccessToken = jwt.sign(
      { id: user_id, email },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const newRefreshToken = generateRefreshToken();
    const newExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'] || 'unknown';

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user_id, hashToken(newRefreshToken), deviceInfo, newExpires]
    );

    // Set new cookies
    res.cookie('access_token', newAccessToken, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.cookie('refresh_token', newRefreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// ─── 2FA: Verify OTP code and complete login ───────────────────────────────
router.post('/verify-2fa', authRateLimit, async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Email and verification code are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, is_admin, is_banned, full_name, bio, avatar_url, is_private,
              show_online_status, show_last_seen, otp_code, otp_expires_at, two_fa_enabled
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({ message: 'Account suspended' });
    }

    // Check OTP validity
    if (!user.otp_code || !user.otp_expires_at) {
      return res.status(400).json({ message: 'No verification code pending. Please log in again.' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      // Clear expired OTP
      await pool.query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);
      return res.status(400).json({ message: 'Verification code expired. Please log in again.' });
    }

    if (user.otp_code !== code.trim()) {
      return res.status(401).json({ message: 'Invalid verification code' });
    }

    // OTP is valid — clear it and issue tokens
    await pool.query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'] || 'unknown';

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hashToken(refreshToken), deviceInfo, refreshExpires]
    ).catch(() => {});

    const { otp_code, otp_expires_at, ...userWithoutSensitive } = user;

    res.cookie('access_token', token, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });

    res.json({
      token,
      refreshToken,
      user: userWithoutSensitive,
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: '2FA verification failed' });
  }
});

// ─── 2FA: Enable two-factor authentication ─────────────────────────────────
router.post('/enable-2fa', verifyToken, async (req: AuthRequest, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password is required to enable 2FA' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash, two_fa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    if (user.two_fa_enabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    await pool.query('UPDATE users SET two_fa_enabled = true WHERE id = $1', [req.user!.id]);

    res.json({ message: 'Two-factor authentication enabled successfully', two_fa_enabled: true });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ message: 'Failed to enable 2FA' });
  }
});

// ─── 2FA: Disable two-factor authentication ────────────────────────────────
router.post('/disable-2fa', verifyToken, async (req: AuthRequest, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password is required to disable 2FA' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash, two_fa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.two_fa_enabled) {
      return res.status(400).json({ message: '2FA is already disabled' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    await pool.query(
      'UPDATE users SET two_fa_enabled = false, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [req.user!.id]
    );

    res.json({ message: 'Two-factor authentication disabled', two_fa_enabled: false });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
});

// ─── 2FA: Check 2FA status ─────────────────────────────────────────────────
router.get('/2fa-status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT two_fa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json({ two_fa_enabled: result.rows[0]?.two_fa_enabled || false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check 2FA status' });
  }
});

export default router;