import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { uploadImage, deleteFromCloudinary } from '../utils/cloudinary';
import { postRateLimit } from '../middleware/rateLimiter';

const router = Router();
router.use(verifyToken);

router.post('/', postRateLimit, async (req: AuthRequest, res: Response) => {
  const { image_base64 } = req.body;

  // Validate image
  if (!image_base64 || !image_base64.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Valid image is required' });
  }

  // Check size (approx base64 size)
  const sizeInBytes = (image_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image must be under 5MB' });
  }

  try {
    const imageUrl = await uploadImage(image_base64);
    const result = await pool.query(
      'INSERT INTO stories (user_id, image_url) VALUES ($1, $2) RETURNING *',
      [req.user!.id, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create story' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.avatar_url
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.expires_at > NOW()
       AND (
         s.user_id = $1
         OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       )
       AND s.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY CASE WHEN s.user_id = $1 THEN 0 ELSE 1 END, s.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stories' });
  }
});

// DELETE /api/stories/:id — Delete own story early
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const storyId = parseInt(String(req.params.id));
  if (isNaN(storyId)) return res.status(400).json({ message: 'Invalid story ID' });
  try {
    const result = await pool.query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING image_url',
      [storyId, req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Story not found or not yours' });

    // Cleanup Cloudinary
    if (result.rows[0].image_url?.includes('res.cloudinary.com')) {
      deleteFromCloudinary(result.rows[0].image_url);
    }

    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete story' });
  }
});

// POST /api/stories/:id/view — Record that a user viewed a story
router.post('/:id/view', async (req: AuthRequest, res: Response) => {
  const storyId = parseInt(String(req.params.id));
  if (isNaN(storyId)) return res.status(400).json({ message: 'Invalid story ID' });
  try {
    // Don't record self-views
    const story = await pool.query('SELECT user_id FROM stories WHERE id = $1 AND expires_at > NOW()', [storyId]);
    if (story.rows.length === 0) return res.status(404).json({ message: 'Story not found or expired' });
    if (story.rows[0].user_id === req.user!.id) return res.json({ viewed: true }); // skip self

    await pool.query(
      'INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [storyId, req.user!.id]
    );
    res.json({ viewed: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record view' });
  }
});

// GET /api/stories/:id/views — Story owner sees who viewed their story
router.get('/:id/views', async (req: AuthRequest, res: Response) => {
  const storyId = parseInt(String(req.params.id));
  if (isNaN(storyId)) return res.status(400).json({ message: 'Invalid story ID' });
  try {
    // Only the story owner can see views
    const story = await pool.query('SELECT user_id FROM stories WHERE id = $1', [storyId]);
    if (story.rows.length === 0) return res.status(404).json({ message: 'Story not found' });
    if (story.rows[0].user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Only the story owner can view this' });
    }

    const views = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, sv.viewed_at
       FROM story_views sv JOIN users u ON sv.viewer_id = u.id
       WHERE sv.story_id = $1
       ORDER BY sv.viewed_at DESC`,
      [storyId]
    );
    res.json({ views: views.rows, count: views.rows.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch views' });
  }
});

export default router;