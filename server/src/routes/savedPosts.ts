import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

router.post('/:postId', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.postId as string);
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    // Check if post owner is private
    const postCheck = await pool.query(
      `SELECT p.user_id, u.is_private FROM posts p
       JOIN users u ON p.user_id = u.id WHERE p.id = $1`, [postId]
    );
    if (postCheck.rows.length === 0)
      return res.status(404).json({ message: 'Post not found' });
    const { user_id: ownerId, is_private } = postCheck.rows[0];

    // Private account posts CANNOT be saved by other users
    if (is_private && ownerId !== req.user!.id) {
      return res.status(403).json({ message: 'Cannot save posts from private accounts' });
    }

    await pool.query('INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)', [req.user!.id, postId]);

    // Log save for notification (skip self-save)
    if (ownerId !== req.user!.id) {
      await pool.query(
        `INSERT INTO content_interactions (user_id, post_id, owner_id, action_type)
         VALUES ($1, $2, $3, 'save')
         ON CONFLICT ON CONSTRAINT unique_user_post_action DO NOTHING`,
        [req.user!.id, postId, ownerId]
      );
    }

    res.json({ saved: true });
  } catch (error) {
    res.status(400).json({ message: 'Already saved' });
  }
});

router.delete('/:postId', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.postId as string);
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    await pool.query('DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2', [req.user!.id, postId]);
    res.json({ saved: false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unsave' });
  }
});

// Paginated saved posts
router.get('/', async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query(
      `SELECT p.*, u.username, u.avatar_url,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count
       FROM saved_posts sp
       JOIN posts p ON sp.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE sp.user_id = $1
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch saved posts' });
  }
});

export default router;