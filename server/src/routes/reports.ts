import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { validateReport, handleValidationErrors } from '../middleware/validator';
import { reportRateLimit } from '../middleware/rateLimiter';

const router = Router();
router.use(verifyToken);

// POST /api/reports — submit a report (with duplicate prevention)
router.post('/', reportRateLimit, validateReport, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { reported_user_id, post_id, reason, description } = req.body;

  try {
    // Validate reported targets exist
    if (reported_user_id) {
      const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [reported_user_id]);
      if (userExists.rows.length === 0) return res.status(400).json({ message: 'Reported user not found' });
    }
    if (post_id) {
      const postExists = await pool.query('SELECT id FROM posts WHERE id = $1', [post_id]);
      if (postExists.rows.length === 0) return res.status(400).json({ message: 'Reported post not found' });
    }
    if (!reported_user_id && !post_id) {
      return res.status(400).json({ message: 'Must report a user or post' });
    }

    // Prevent self-reporting
    if (reported_user_id && reported_user_id === req.user!.id) {
      return res.status(400).json({ message: 'Cannot report yourself' });
    }

    // Prevent duplicate reports from the same user for the same target
    const existing = await pool.query(
      `SELECT id FROM reports
       WHERE reporter_id = $1 AND reported_user_id IS NOT DISTINCT FROM $2 AND post_id IS NOT DISTINCT FROM $3 AND status = 'pending'`,
      [req.user!.id, reported_user_id || null, post_id || null]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'You have already reported this. It is under review.' });
    }

    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, post_id, reason, description) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, reported_user_id || null, post_id || null, reason, description || null]
    );
    res.status(201).json({ message: 'Report submitted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit report' });
  }
});

export default router;