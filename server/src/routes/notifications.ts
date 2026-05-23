import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT n.*,
       COALESCE(u.username, 'Deleted User') as actor_username,
       u.avatar_url as actor_avatar,
       sp.id as screenshot_request_id
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       LEFT JOIN screenshot_permissions sp
         ON n.type = 'screenshot_request'
         AND sp.owner_id = n.user_id
         AND sp.requester_id = n.actor_id
         AND sp.post_id = n.post_id
         AND sp.status = 'pending'
       WHERE n.user_id = $1
       AND n.actor_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY n.created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  const notifId = parseInt(String(req.params.id));
  if (isNaN(notifId)) return res.status(400).json({ message: 'Invalid notification ID' });
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [notifId, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND is_read = false
       AND actor_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )`,
      [req.user!.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch count' });
  }
});

router.put('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

export default router;