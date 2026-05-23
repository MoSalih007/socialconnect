import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { searchRateLimit } from '../middleware/rateLimiter';

const router = Router();
router.use(verifyToken);

// GET /api/search?q=query
router.get('/', searchRateLimit, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.status(400).json({ message: 'Query required' });

  // Sanitize ILIKE special characters and limit length
  const sanitized = q.replace(/[%_\\]/g, '\\$&');
  if (sanitized.length > 50) return res.status(400).json({ message: 'Query too long' });

  try {
    const users = await pool.query(
      `SELECT id, username, full_name, avatar_url 
       FROM users 
       WHERE (username ILIKE $1 OR full_name ILIKE $1)
       AND id != $2
       AND id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $2
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $2
       )
       LIMIT 10`,
      [`%${sanitized}%`, req.user!.id]
    );

    const hashtags = await pool.query(
      `SELECT tag, post_count 
       FROM hashtags 
       WHERE tag ILIKE $1 
       ORDER BY post_count DESC 
       LIMIT 10`,
      [`%${sanitized}%`]
    );

    res.json({ users: users.rows, hashtags: hashtags.rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

export default router;