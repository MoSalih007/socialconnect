import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

// GET /api/hashtags/trending
router.get('/trending', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT tag, post_count FROM hashtags WHERE post_count > 0 ORDER BY post_count DESC, last_used_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// GET /api/hashtags/search — MUST be before /:tag/posts
router.get('/search', async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.status(400).json({ message: 'Query required' });
  const sanitized = (q as string).replace(/[%_\\]/g, '\\$&');
  try {
    const result = await pool.query(
      'SELECT tag, post_count FROM hashtags WHERE tag ILIKE $1 ORDER BY post_count DESC LIMIT 10',
      [`%${sanitized.toLowerCase()}%`]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Search failed' });
  }
});

// GET /api/hashtags/:tag/posts
router.get('/:tag/posts', async (req: AuthRequest, res: Response) => {
  const tag = String(req.params.tag).toLowerCase();
  try {
    const result = await pool.query(
      `SELECT p.*, u.username, u.avatar_url,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN post_hashtags ph ON p.id = ph.post_id
       JOIN hashtags h ON ph.hashtag_id = h.id
       WHERE h.tag = $2 AND p.status = 'approved'
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       AND (u.is_private = false OR p.user_id = $1
            OR EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = p.user_id))
       ORDER BY p.created_at DESC LIMIT 50`,
      [req.user!.id, tag]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

export default router;