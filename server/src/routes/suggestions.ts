import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

// GET /api/suggestions — people followed by your friends that you don't follow yet
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.avatar_url,
         u.full_name,
         COUNT(DISTINCT f2.follower_id) as mutual_count
       FROM follows f1
       JOIN follows f2 ON f2.following_id = f1.following_id AND f2.follower_id != $1
       JOIN users u ON u.id = f2.follower_id
       WHERE f1.follower_id = $1
         AND f2.follower_id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
         AND f2.follower_id != $1
         AND u.is_banned = false
         AND u.id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
         -- Exclude users with pending follow requests
         AND u.id NOT IN (
           SELECT requested_id FROM follow_requests WHERE requester_id = $1
         )
       GROUP BY u.id, u.username, u.avatar_url, u.full_name
       ORDER BY mutual_count DESC
       LIMIT 10`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ message: 'Failed to fetch suggestions' });
  }
});

export default router;
