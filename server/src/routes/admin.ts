import { Router, Response, NextFunction } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken, banCache } from '../middleware/auth';
import { deleteFromCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(verifyToken);

// Admin role hierarchy
// Level 0 = regular user
// Level 1 = moderator (can review content, resolve reports)
// Level 2 = admin (can ban users, manage content)
// Level 3 = superadmin (can promote/demote admins, full access)

async function getAdminLevel(userId: number): Promise<number> {
  const result = await pool.query('SELECT is_admin, admin_level FROM users WHERE id = $1', [userId]);
  if (!result.rows[0]) return 0;
  // Use admin_level column if it exists, otherwise fall back to is_admin boolean
  if (result.rows[0].admin_level !== undefined && result.rows[0].admin_level !== null) {
    return result.rows[0].admin_level;
  }
  return result.rows[0].is_admin ? 2 : 0; // backwards compat: is_admin=true → level 2
}

// Middleware: require minimum admin level (default: 1 = moderator)
function requireAdminLevel(minLevel: number = 1) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const level = await getAdminLevel(req.user!.id);
      if (level < minLevel) {
        return res.status(403).json({ message: `Requires admin level ${minLevel}+ (you have ${level})` });
      }
      (req as any).adminLevel = level;
      next();
    } catch (error) {
      res.status(500).json({ message: 'Admin check failed' });
    }
  };
}

// Legacy wrapper — most existing routes just need "is admin" (level 2)
const requireAdmin = requireAdminLevel(2);

// --- Dashboard Stats ---

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM posts) AS posts,
        (SELECT COUNT(*)::int FROM messages) AS messages,
        (SELECT COUNT(*)::int FROM reports WHERE status = 'pending') AS "pendingReports",
        (SELECT COUNT(*)::int FROM posts WHERE status = 'flagged') AS "flaggedPosts"
    `);
    res.json(r.rows[0]);
  } catch (error) {
    console.error('Admin stats error:', error);
    res.json({ users: 0, posts: 0, messages: 0, pendingReports: 0, flaggedPosts: 0 });
  }
});

// --- Reports ---

// GET /api/admin/reports
router.get('/reports', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.reason,
         r.description,
         r.status,
         r.created_at,
         r.post_id,
         reporter.username   AS reporter_username,
         reporter.avatar_url AS reporter_avatar,
         reported.username   AS reported_username,
         r.reported_user_id
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id      = reporter.id
       LEFT JOIN users reported  ON r.reported_user_id = reported.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

// PUT /api/admin/reports/:id/resolve
router.put('/reports/:id/resolve', requireAdmin, async (req: AuthRequest, res: Response) => {
  const reportId = parseInt(req.params.id as string);
  if (isNaN(reportId)) return res.status(400).json({ message: 'Invalid report ID' });

  try {
    await pool.query("UPDATE reports SET status = 'resolved', resolved_at = NOW(), resolved_by = $2 WHERE id = $1", [reportId, req.user!.id]);

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'resolve_report', reportId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resolve report' });
  }
});

// --- User Management ---

// GET /api/admin/users
router.get('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         id, username, email, full_name, avatar_url,
         is_admin, is_verified, is_banned, created_at,
         (SELECT COUNT(*) FROM posts   WHERE user_id      = users.id)::int AS posts_count,
         (SELECT COUNT(*) FROM follows WHERE following_id = users.id)::int AS followers_count
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/ban
router.put('/users/:id/ban', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

  if (userId === req.user!.id) {
    return res.status(400).json({ message: 'Cannot ban yourself' });
  }

  try {
    // Prevent banning admins of equal or higher level (escalation protection)
    const targetLevel = await getAdminLevel(userId);
    if (targetLevel >= (req as any).adminLevel) {
      return res.status(403).json({ message: 'Cannot ban an admin of equal or higher level' });
    }

    await pool.query('UPDATE users SET is_banned = true, banned_at = NOW() WHERE id = $1', [userId]);

    // Immediately invalidate ban cache so the ban takes effect NOW
    banCache.delete(userId);

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'ban_user', userId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to ban user' });
  }
});

// PUT /api/admin/users/:id/unban
router.put('/users/:id/unban', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    await pool.query('UPDATE users SET is_banned = false, banned_at = NULL WHERE id = $1', [userId]);

    // Immediately invalidate ban cache so the unban takes effect NOW
    banCache.delete(userId);

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'unban_user', userId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unban user' });
  }
});

// --- User Activity Log ---

// GET /api/admin/users/:id/activity
router.get('/users/:id/activity', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    // Get user info
    const userResult = await pool.query(
      'SELECT id, username, email, full_name, avatar_url, is_banned, is_verified, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    // Get recent posts (last 20)
    const postsResult = await pool.query(
      `SELECT id, caption, status, image_url, created_at,
       (SELECT COUNT(*) FROM likes WHERE post_id = posts.id)::int AS likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = posts.id)::int AS comments_count
       FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    // Get recent comments (last 20)
    const commentsResult = await pool.query(
      `SELECT c.id, c.body, c.created_at, p.id AS post_id, p.caption AS post_caption
       FROM comments c JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 20`,
      [userId]
    );

    // Get stats
    const statsResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM posts WHERE user_id = $1)::int AS total_posts,
         (SELECT COUNT(*) FROM comments WHERE user_id = $1)::int AS total_comments,
         (SELECT COUNT(*) FROM likes WHERE user_id = $1)::int AS total_likes,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1)::int AS following_count,
         (SELECT COUNT(*) FROM follows WHERE following_id = $1)::int AS followers_count,
         (SELECT COUNT(*) FROM reports WHERE reported_user_id = $1)::int AS reports_against`,
      [userId]
    );

    // Get device sessions (without PIN data — just device info)
    const devicesResult = await pool.query(
      'SELECT device_fingerprint, is_trusted, last_used, created_at FROM device_sessions WHERE user_id = $1 ORDER BY last_used DESC',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      recentPosts: postsResult.rows,
      recentComments: commentsResult.rows,
      stats: statsResult.rows[0],
      devices: devicesResult.rows,
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ message: 'Failed to fetch user activity' });
  }
});

// --- Content Moderation ---

// GET /api/admin/posts/flagged — get all non-approved posts
router.get('/posts/flagged', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.caption, p.image_url, p.status, p.created_at,
       u.username, u.avatar_url,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments_count
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.status IN ('flagged', 'pending')
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch flagged posts' });
  }
});

// PUT /api/admin/posts/:id/approve
router.put('/posts/:id/approve', requireAdmin, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id as string);
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });

  try {
    await pool.query("UPDATE posts SET status = 'approved' WHERE id = $1", [postId]);

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'approve_post', postId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve post' });
  }
});

// DELETE /api/admin/posts/:id — admin delete a post + Cloudinary cleanup
router.delete('/posts/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id as string);
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });

  try {
    // Decrement hashtag counts
    await pool.query(
      `UPDATE hashtags SET post_count = GREATEST(post_count - 1, 0)
       WHERE id IN (SELECT hashtag_id FROM post_hashtags WHERE post_id = $1)`,
      [postId]
    );

    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING id, user_id, image_url', [postId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Post not found' });

    // Cloudinary cleanup (non-blocking)
    const imageUrl = result.rows[0].image_url;
    if (imageUrl) {
      deleteFromCloudinary(imageUrl);
    }

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'delete_post', postId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

// --- Audit Log ---

// GET /api/admin/audit-log
router.get('/audit-log', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT al.id, al.action, al.target_id, al.ip_address, al.created_at,
       u.username AS admin_username, u.avatar_url AS admin_avatar
       FROM audit_log al
       LEFT JOIN users u ON al.admin_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit log' });
  }
});

// --- Forced Password Reset ---

// POST /api/admin/users/:id/force-reset
router.post('/users/:id/force-reset', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);
  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

  if (userId === req.user!.id) {
    return res.status(400).json({ message: 'Cannot force reset your own password' });
  }

  try {
    // Prevent force-resetting password of admins of equal or higher level (escalation protection)
    const targetLevel = await getAdminLevel(userId);
    if (targetLevel >= (req as any).adminLevel) {
      return res.status(403).json({ message: 'Cannot force reset password of an admin of equal or higher level' });
    }

    await pool.query('UPDATE users SET must_reset_password = true WHERE id = $1', [userId]);

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'force_password_reset', userId, req.ip]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to force password reset' });
  }
});


// PUT /api/admin/users/:id/level — Superadmin: set admin level
router.put('/users/:id/level', requireAdminLevel(3), async (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id));
  const { admin_level } = req.body;

  if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });
  if (typeof admin_level !== 'number' || admin_level < 0 || admin_level > 3) {
    return res.status(400).json({ message: 'admin_level must be 0-3' });
  }
  if (userId === req.user!.id) {
    return res.status(400).json({ message: 'Cannot change your own admin level' });
  }

  try {
    await pool.query(
      'UPDATE users SET admin_level = $1, is_admin = $2 WHERE id = $3',
      [admin_level, admin_level >= 2, userId]
    );

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, target_id, ip_address, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'change_admin_level', userId, req.ip || 'unknown', JSON.stringify({ new_level: admin_level })]
    );

    const levelNames = ['User', 'Moderator', 'Admin', 'Superadmin'];
    res.json({ success: true, message: `User set to ${levelNames[admin_level]}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update admin level' });
  }
});

export default router;