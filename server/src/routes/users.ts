import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { accountDeletionRateLimit, heartbeatRateLimit } from '../middleware/rateLimiter';
import { uploadImage, deleteFromCloudinary } from '../utils/cloudinary';
import { sendEmailChangeOTP } from '../utils/emailService';

const router = Router();
router.use(verifyToken);

function sanitizeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// Generate a 6-digit OTP code for email change
function generateEmailOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/users/heartbeat — dedicated rate limit
router.post('/heartbeat', heartbeatRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [req.user!.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Heartbeat failed' });
  }
});

// GET /api/users/profile/:username - Get user profile
router.get('/profile/:username', async (req: AuthRequest, res: Response) => {
  const username = req.params.username as string;

  try {
    const userResult = await pool.query(
      `SELECT id, username, full_name, bio, avatar_url, cover_url, is_private, created_at,
       last_active, show_online_status, show_last_seen,
       (SELECT COUNT(*)::int FROM posts WHERE user_id = users.id AND status = 'approved') as posts_count,
       (SELECT COUNT(*)::int FROM follows WHERE following_id = users.id) as followers_count,
       (SELECT COUNT(*)::int FROM follows WHERE follower_id = users.id) as following_count,
       EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = users.id) as is_following,
       EXISTS(SELECT 1 FROM blocks WHERE blocker_id = users.id AND blocked_id = $1) as has_blocked_me,
       EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = users.id) as i_blocked,
       EXISTS(SELECT 1 FROM stories WHERE user_id = users.id AND expires_at > NOW()) as has_story
       FROM users
       WHERE username = $2`,
      [req.user!.id, username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // If blocked, return minimal info
    if (user.has_blocked_me || user.i_blocked) {
      return res.json({
        id: user.id,
        username: user.username,
        blocked: true
      });
    }

    // Get posts (if public or following)
    let posts: any[] = [];
    if (!user.is_private || user.is_following || user.id === req.user!.id) {
      const postsResult = await pool.query(
        `SELECT p.*, 
         (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
         FROM posts p
         WHERE p.user_id = $1 AND p.status = 'approved'
         ORDER BY p.created_at DESC
         LIMIT 30`,
        [user.id]
      );
      posts = postsResult.rows;
    }

    // Compute online status — only if user allows it
    const isOnline = user.show_online_status && user.last_active && (Date.now() - new Date(user.last_active).getTime()) < 5 * 60 * 1000;

    res.json({
      ...user,
      posts,
      is_online: isOnline,
      last_active: user.show_last_seen ? user.last_active : null,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// POST /api/users/follow/:id - Follow user
router.post('/follow/:id', async (req: AuthRequest, res: Response) => {
  const followingId = parseInt(req.params.id as string);
  if (isNaN(followingId)) return res.status(400).json({ message: 'Invalid user ID' });

  if (followingId === req.user!.id) {
    return res.status(400).json({ message: 'Cannot follow yourself' });
  }

  try {
    // Block check
    const blocked = await pool.query(
      'SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
      [req.user!.id, followingId]
    );
    if (blocked.rows.length > 0) return res.status(403).json({ message: 'Cannot follow this user' });

    const userResult = await pool.query('SELECT is_private FROM users WHERE id = $1', [followingId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userResult.rows[0].is_private) {
      await pool.query(
        'INSERT INTO follow_requests (requester_id, requested_id) VALUES ($1, $2)',
        [req.user!.id, followingId]
      );
      // Notify about follow request
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type) VALUES ($1, $2, $3)',
        [followingId, req.user!.id, 'follow_request']
      ).catch(() => {});
      return res.json({ following: false, requested: true });
    }

    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [req.user!.id, followingId]
    );

    // Create follow notification
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type) VALUES ($1, $2, $3)',
      [followingId, req.user!.id, 'follow']
    ).catch(() => {});

    res.json({ following: true });
  } catch (error) {
    res.status(400).json({ message: 'Already following or requested' });
  }
});

// GET /api/users/follow-requests - Get pending follow requests for current user
router.get('/follow-requests', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT fr.id, fr.requester_id, u.username, u.full_name, u.avatar_url, fr.created_at
       FROM follow_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.requested_id = $1
       ORDER BY fr.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch follow requests' });
  }
});

// POST /api/users/follow-requests/:id/accept - Accept a follow request
router.post('/follow-requests/:id/accept', async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(req.params.id as string);
  if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });

  try {
    const request = await pool.query(
      'SELECT requester_id, requested_id FROM follow_requests WHERE id = $1 AND requested_id = $2',
      [requestId, req.user!.id]
    );
    if (request.rows.length === 0) {
      return res.status(404).json({ message: 'Follow request not found' });
    }

    const { requester_id } = request.rows[0];

    // Create the follow and delete the request
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [requester_id, req.user!.id]
    );
    await pool.query('DELETE FROM follow_requests WHERE id = $1', [requestId]);

    res.json({ accepted: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept follow request' });
  }
});

// POST /api/users/follow-requests/:id/reject - Reject a follow request
router.post('/follow-requests/:id/reject', async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(req.params.id as string);
  if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });

  try {
    const result = await pool.query(
      'DELETE FROM follow_requests WHERE id = $1 AND requested_id = $2 RETURNING id',
      [requestId, req.user!.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Follow request not found' });
    }
    res.json({ rejected: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject follow request' });
  }
});

// DELETE /api/users/follow/:id - Unfollow user
router.delete('/follow/:id', async (req: AuthRequest, res: Response) => {
  const followingId = parseInt(req.params.id as string);
  if (isNaN(followingId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user!.id, followingId]
    );
    res.json({ following: false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unfollow' });
  }
});

// PUT /api/users/avatar - Update avatar
router.put('/avatar', async (req: AuthRequest, res: Response) => {
  const { avatar_base64 } = req.body;

  if (!avatar_base64?.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Invalid image' });
  }

  // Size check — prevent DoS via oversized uploads
  const sizeInBytes = (avatar_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image must be under 5MB' });
  }

  try {
    // Fetch old avatar for cleanup
    const oldResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user!.id]);
    const oldAvatarUrl = oldResult.rows[0]?.avatar_url;

    const imageUrl = await uploadImage(avatar_base64);
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [imageUrl, req.user!.id]);

    // Clean up old avatar from Cloudinary (non-blocking)
    if (oldAvatarUrl) deleteFromCloudinary(oldAvatarUrl);

    res.json({ avatar_url: imageUrl });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed' });
  }
});

// PUT /api/users/profile - Update profile
router.put('/profile', async (req: AuthRequest, res: Response) => {
  const { full_name, bio } = req.body;

  if (bio && bio.length > 150) {
    return res.status(400).json({ message: 'Bio max 150 characters' });
  }

  try {
    const safeName = full_name ? sanitizeText(full_name.trim()) : null;
    const safeBio = bio ? sanitizeText(bio.trim()) : null;
    const result = await pool.query(
      'UPDATE users SET full_name = $1, bio = $2 WHERE id = $3 RETURNING id, username, email, full_name, bio, avatar_url, cover_url',
      [safeName, safeBio, req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT /api/users/cover - Update cover image
router.put('/cover', async (req: AuthRequest, res: Response) => {
  const { cover_base64 } = req.body;

  if (!cover_base64?.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Invalid image' });
  }

  const sizeInBytes = (cover_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 8 * 1024 * 1024) {
    return res.status(400).json({ message: 'Cover image must be under 8MB' });
  }

  try {
    // Fetch old cover for cleanup
    const oldResult = await pool.query('SELECT cover_url FROM users WHERE id = $1', [req.user!.id]);
    const oldCoverUrl = oldResult.rows[0]?.cover_url;

    const imageUrl = await uploadImage(cover_base64);
    await pool.query('UPDATE users SET cover_url = $1 WHERE id = $2', [imageUrl, req.user!.id]);

    // Clean up old cover from Cloudinary (non-blocking)
    if (oldCoverUrl) deleteFromCloudinary(oldCoverUrl);

    res.json({ cover_url: imageUrl });
  } catch (error) {
    res.status(500).json({ message: 'Cover upload failed' });
  }
});

// PUT /api/users/privacy - Toggle private account
router.put('/privacy', async (req: AuthRequest, res: Response) => {
  const { is_private } = req.body;

  if (typeof is_private !== 'boolean') {
    return res.status(400).json({ message: 'is_private must be a boolean' });
  }

  try {
    await pool.query('UPDATE users SET is_private = $1 WHERE id = $2', [is_private, req.user!.id]);

    // When switching from private → public, auto-approve all pending follow requests
    if (is_private === false) {
      const pending = await pool.query(
        'SELECT requester_id FROM follow_requests WHERE requested_id = $1',
        [req.user!.id]
      );
      for (const row of pending.rows) {
        await pool.query(
          'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [row.requester_id, req.user!.id]
        );
      }
      await pool.query('DELETE FROM follow_requests WHERE requested_id = $1', [req.user!.id]);
      if (pending.rows.length > 0) {
        console.log(`Auto-approved ${pending.rows.length} follow requests for user ${req.user!.id}`);
      }
    }

    res.json({ is_private });
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT /api/users/online-privacy — toggle show online status / last seen
router.put('/online-privacy', async (req: AuthRequest, res: Response) => {
  const { show_online_status, show_last_seen } = req.body;

  try {
    if (show_online_status !== undefined && typeof show_online_status !== 'boolean') {
      return res.status(400).json({ message: 'show_online_status must be a boolean' });
    }
    if (show_last_seen !== undefined && typeof show_last_seen !== 'boolean') {
      return res.status(400).json({ message: 'show_last_seen must be a boolean' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (show_online_status !== undefined) {
      updates.push(`show_online_status = $${paramIdx++}`);
      values.push(show_online_status);
    }
    if (show_last_seen !== undefined) {
      updates.push(`show_last_seen = $${paramIdx++}`);
      values.push(show_last_seen);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.user!.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    res.json({ show_online_status, show_last_seen });
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE /api/users/account - Delete account + clean up all user data & Cloudinary media
router.delete('/account', accountDeletionRateLimit, async (req: AuthRequest, res: Response) => {
  const { password } = req.body;

  try {
    const userResult = await pool.query('SELECT password_hash, avatar_url FROM users WHERE id = $1', [req.user!.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const userId = req.user!.id;

    // 1. Fetch all media URLs for Cloudinary cleanup (before transaction)
    const postsResult = await pool.query('SELECT image_url FROM posts WHERE user_id = $1', [userId]);
    const mediaUrls: string[] = postsResult.rows.map((r: any) => r.image_url).filter(Boolean);

    if (userResult.rows[0].avatar_url) {
      mediaUrls.push(userResult.rows[0].avatar_url);
    }

    const voiceMsgs = await pool.query(
      "SELECT media_url FROM messages WHERE sender_id = $1 AND message_type IN ('voice', 'image') AND media_url IS NOT NULL",
      [userId]
    );
    voiceMsgs.rows.forEach((r: any) => { if (r.media_url) mediaUrls.push(r.media_url); });

    // 2. Delete all related data inside a transaction for atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1', [userId]);
      await client.query('DELETE FROM saved_posts WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM comments WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM likes WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1', [userId]);
      await client.query('DELETE FROM stories WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [userId]);
      await client.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userId]);
      await client.query('DELETE FROM device_sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM follow_requests WHERE requester_id = $1 OR requested_id = $1', [userId]);

      // Delete post-related data, then posts
      await client.query('DELETE FROM post_hashtags WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1)', [userId]);
      await client.query('DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1)', [userId]);
      await client.query('DELETE FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1)', [userId]);
      await client.query('DELETE FROM saved_posts WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1)', [userId]);
      await client.query('DELETE FROM posts WHERE user_id = $1', [userId]);

      // Clean up new messaging/group tables
      await client.query('DELETE FROM message_reactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM group_invitations WHERE inviter_id = $1 OR invitee_id = $1', [userId]);
      await client.query('DELETE FROM group_members WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM content_interactions WHERE user_id = $1 OR owner_id = $1', [userId]);
      await client.query('DELETE FROM screenshot_permissions WHERE requester_id = $1 OR owner_id = $1', [userId]);

      // Invalidate all auth tokens on account deletion
      // IMPORTANT: token_blacklist cleanup MUST happen before refresh_tokens deletion
      // because the subquery references refresh_tokens
      await client.query('DELETE FROM token_blacklist WHERE user_id = $1', [userId]).catch(() => {});
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]).catch(() => {});
      await client.query('DELETE FROM password_resets WHERE user_id = $1', [userId]).catch(() => {});

      // Delete user row
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // 3. Clean up Cloudinary media (non-blocking — after successful transaction)
    for (const url of mediaUrls) {
      deleteFromCloudinary(url);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ message: 'Deletion failed' });
  }
});

// POST /api/users/block/:userId - Block user
router.post('/block/:userId', async (req: AuthRequest, res: Response) => {
  const blockedId = parseInt(req.params.userId as string);
  if (isNaN(blockedId)) return res.status(400).json({ message: 'Invalid user ID' });

  if (blockedId === req.user!.id) {
    return res.status(400).json({ message: 'Cannot block yourself' });
  }

  try {
    await pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [req.user!.id, blockedId]);
    await pool.query('DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)', [req.user!.id, blockedId]);
    res.json({ blocked: true });
  } catch (error) {
    res.status(400).json({ message: 'Block failed' });
  }
});

// DELETE /api/users/block/:userId - Unblock user
router.delete('/block/:userId', async (req: AuthRequest, res: Response) => {
  const blockedId = parseInt(req.params.userId as string);
  if (isNaN(blockedId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user!.id, blockedId]);
    res.json({ blocked: false });
  } catch (error) {
    res.status(500).json({ message: 'Unblock failed' });
  }
});

// GET /api/users/blocked - Get blocked users
router.get('/blocked', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url
       FROM blocks b
       JOIN users u ON b.blocked_id = u.id
       WHERE b.blocker_id = $1`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// PUT /api/users/change-password - Change password
router.put('/change-password', async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both passwords are required' });
  }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({ message: 'Password must be 8+ chars with uppercase, lowercase, and number' });
  }
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// POST /api/users/device/check - Check if device is known
router.post('/device/check', async (req: AuthRequest, res: Response) => {
  const { fingerprint } = req.body;
  if (!fingerprint) return res.status(400).json({ message: 'Fingerprint required' });

  try {
    const result = await pool.query(
      'SELECT id, pin_hash, is_trusted FROM device_sessions WHERE user_id = $1 AND device_fingerprint = $2',
      [req.user!.id, fingerprint]
    );

    if (result.rows.length === 0) {
      return res.json({ needsSetup: true, needsVerification: false });
    }

    const device = result.rows[0];

    if (device.is_trusted) {
      // Update last_used timestamp
      await pool.query(
        'UPDATE device_sessions SET last_used = NOW() WHERE id = $1',
        [device.id]
      );
      return res.json({ needsSetup: false, needsVerification: false });
    }

    if (device.pin_hash) {
      return res.json({ needsSetup: false, needsVerification: true });
    }

    return res.json({ needsSetup: true, needsVerification: false });
  } catch (error) {
    res.status(500).json({ message: 'Device check failed' });
  }
});

// POST /api/users/device/setup - Set up PIN for new device
router.post('/device/setup', async (req: AuthRequest, res: Response) => {
  const { fingerprint, pin } = req.body;
  if (!fingerprint || !pin) return res.status(400).json({ message: 'Fingerprint and PIN required' });
  if (!/^\d{6}$/.test(pin)) return res.status(400).json({ message: 'PIN must be exactly 6 digits' });

  try {
    const pinHash = await bcrypt.hash(pin, 10);
    await pool.query(
      `INSERT INTO device_sessions (user_id, device_fingerprint, pin_hash, is_trusted, failed_attempts, last_used)
       VALUES ($1, $2, $3, true, 0, NOW())
       ON CONFLICT (user_id, device_fingerprint)
       DO UPDATE SET pin_hash = $3, is_trusted = true, failed_attempts = 0, last_used = NOW()`,
      [req.user!.id, fingerprint, pinHash]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'PIN setup failed' });
  }
});

// POST /api/users/device/verify - Verify PIN on known device
router.post('/device/verify', async (req: AuthRequest, res: Response) => {
  const { fingerprint, pin } = req.body;
  if (!fingerprint || !pin) return res.status(400).json({ message: 'Fingerprint and PIN required' });

  try {
    const result = await pool.query(
      'SELECT id, pin_hash, failed_attempts, locked_until FROM device_sessions WHERE user_id = $1 AND device_fingerprint = $2',
      [req.user!.id, fingerprint]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const device = result.rows[0];

    // Check if device is locked
    if (device.locked_until && new Date(device.locked_until) > new Date()) {
      const remainingMs = new Date(device.locked_until).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({ message: `Device locked. Try again in ${remainingMin} minute(s).` });
    }

    const valid = await bcrypt.compare(pin, device.pin_hash);
    if (!valid) {
      // Increment failed attempts
      const newAttempts = (device.failed_attempts || 0) + 1;
      if (newAttempts >= 5) {
        // Lock for 15 minutes
        await pool.query(
          'UPDATE device_sessions SET failed_attempts = $1, locked_until = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
          [newAttempts, device.id]
        );
        return res.status(429).json({ message: 'Too many failed attempts. Device locked for 15 minutes.' });
      } else {
        await pool.query(
          'UPDATE device_sessions SET failed_attempts = $1 WHERE id = $2',
          [newAttempts, device.id]
        );
        return res.status(401).json({ message: `Incorrect PIN. ${5 - newAttempts} attempt(s) remaining.` });
      }
    }

    // Success — reset failed attempts, mark trusted
    await pool.query(
      'UPDATE device_sessions SET is_trusted = true, failed_attempts = 0, locked_until = NULL, last_used = NOW() WHERE id = $1',
      [device.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'PIN verification failed' });
  }
});

// GET /api/users/:id/followers - Paginated followers list
router.get('/:id/followers', async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  try {
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM follows WHERE following_id = $1', [userId]);
    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, req.user!.id, limit, offset]
    );
    res.json({ users: result.rows, pagination: { page, limit, total: countResult.rows[0].total } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch followers' });
  }
});

// GET /api/users/:id/following - Paginated following list
router.get('/:id/following', async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  try {
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM follows WHERE follower_id = $1', [userId]);
    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, req.user!.id, limit, offset]
    );
    res.json({ users: result.rows, pagination: { page, limit, total: countResult.rows[0].total } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch following' });
  }
});


// PUT /api/users/change-email - Request email change (sends OTP to new email)
router.put('/change-email', async (req: AuthRequest, res: Response) => {
  const { newEmail, password } = req.body;

  if (!newEmail || typeof newEmail !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ message: 'New email and password are required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Verify password
    const userResult = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Check if same as current
    if (user.email === newEmail.toLowerCase()) {
      return res.status(400).json({ message: 'This is already your current email' });
    }

    // Check if new email is taken
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [newEmail.toLowerCase(), req.user!.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'This email is already in use' });
    }

    // Generate OTP and store pending email
    const otpCode = generateEmailOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'UPDATE users SET pending_email = $1, otp_code = $2, otp_expires_at = $3 WHERE id = $4',
      [newEmail.toLowerCase(), otpCode, otpExpires, req.user!.id]
    );

    // Send OTP to the NEW email
    try {
      await sendEmailChangeOTP(newEmail, user.username, otpCode);
    } catch (emailErr) {
      console.error('Email change OTP send failed:', emailErr);
      return res.status(500).json({ message: 'Failed to send verification code. Try again.' });
    }

    res.json({
      message: 'Verification code sent to your new email',
      pendingEmail: newEmail.toLowerCase(),
    });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ message: 'Failed to initiate email change' });
  }
});

// POST /api/users/verify-email-change - Verify OTP and complete email change
router.post('/verify-email-change', async (req: AuthRequest, res: Response) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Verification code is required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, pending_email, otp_code, otp_expires_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.pending_email || !user.otp_code || !user.otp_expires_at) {
      return res.status(400).json({ message: 'No email change pending. Please request a new change.' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      await pool.query(
        'UPDATE users SET pending_email = NULL, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
        [req.user!.id]
      );
      return res.status(400).json({ message: 'Verification code expired. Please request a new change.' });
    }

    if (user.otp_code !== code.trim()) {
      return res.status(401).json({ message: 'Invalid verification code' });
    }

    // OTP valid — update email and clear pending state
    await pool.query(
      'UPDATE users SET email = $1, pending_email = NULL, otp_code = NULL, otp_expires_at = NULL WHERE id = $2',
      [user.pending_email, req.user!.id]
    );

    res.json({
      message: 'Email changed successfully',
      email: user.pending_email,
    });
  } catch (error) {
    console.error('Verify email change error:', error);
    res.status(500).json({ message: 'Failed to verify email change' });
  }
});

export default router;