import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { postRateLimit } from '../middleware/rateLimiter';
import { validatePost, validateComment, handleValidationErrors } from '../middleware/validator';
import { uploadImage, deleteFromCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(verifyToken);

function sanitizeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function extractHashtags(text: string): string[] {
  if (!text) return [];
  // Unicode-aware hashtag regex — supports Malayalam, Arabic, Hindi, etc.
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
  return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
}

// POST /api/posts
router.post('/', postRateLimit, validatePost, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { image_base64, video_base64, caption } = req.body;
  const mediaBase64 = video_base64 || image_base64;
  const mediaType = video_base64 ? 'video' : 'image';

  if (!mediaBase64) {
    return res.status(400).json({ message: 'Image or video is required' });
  }

  try {
    const mediaUrl = await uploadImage(mediaBase64);
    const sanitizedCaption = caption ? sanitizeText(caption.trim()) : null;
    const result = await pool.query(
      'INSERT INTO posts (user_id, image_url, caption, media_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user!.id, mediaUrl, sanitizedCaption, mediaType]
    );
    const post = result.rows[0];
    const hashtags = extractHashtags(caption || '');
    for (const tag of hashtags) {
      const hashtagResult = await pool.query(
        `INSERT INTO hashtags (tag, post_count) VALUES ($1, 1)
         ON CONFLICT (tag) DO UPDATE SET post_count = hashtags.post_count + 1, last_used_at = NOW()
         RETURNING id`,
        [tag]
      );
      await pool.query(
        'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [post.id, hashtagResult.rows[0].id]
      );
    }
    res.status(201).json(post);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

// GET /api/posts/feed
router.get('/feed', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user follows anyone
    const followCheck = await pool.query('SELECT COUNT(*)::int AS cnt FROM follows WHERE follower_id = $1', [req.user!.id]);
    const followsAnyone = followCheck.rows[0].cnt > 0;

    let query: string;
    if (followsAnyone) {
      // Normal feed: posts from followed users + own posts
      query = `SELECT p.*, u.username, u.avatar_url, u.is_private AS owner_is_private,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as is_saved
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.status = 'approved'
       AND (p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) OR p.user_id = $1)
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY p.created_at DESC LIMIT 50`;
    } else {
      // Discovery feed: trending public posts for new users
      query = `SELECT p.*, u.username, u.avatar_url, u.is_private AS owner_is_private,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as is_saved
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.status = 'approved'
       AND (u.is_private = false OR p.user_id = $1)
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY (SELECT COUNT(*) FROM likes WHERE post_id = p.id) DESC, p.created_at DESC LIMIT 30`;
    }

    const result = await pool.query(query, [req.user!.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ message: 'Failed to fetch feed' });
  }
});

// GET /api/posts/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    const result = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, u.is_private AS owner_is_private,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as is_saved
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.id = $2 AND (p.status = 'approved' OR p.user_id = $1)`,
      [req.user!.id, postId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch post' });
  }
});

// POST /api/posts/:id/like
router.post('/:id/like', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    // Verify post exists and is approved
    const postCheck = await pool.query("SELECT user_id FROM posts WHERE id = $1 AND status = 'approved'", [postId]);
    if (postCheck.rows.length === 0) return res.status(404).json({ message: 'Post not found' });

    await pool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [req.user!.id, postId]);

    // Create notification (skip self-like)
    const ownerId = postCheck.rows[0].user_id;
    if (ownerId !== req.user!.id) {
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [ownerId, req.user!.id, 'like', postId]
      ).catch(() => {});
    }

    res.json({ liked: true });
  } catch (error) {
    res.status(400).json({ message: 'Already liked' });
  }
});

// DELETE /api/posts/:id/like
router.delete('/:id/like', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.user!.id, postId]);
    res.json({ liked: false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unlike' });
  }
});

// POST /api/posts/:id/comments — only on approved posts
router.post('/:id/comments', validateComment, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  const { body } = req.body;
  try {
    // Verify post exists and is approved
    const postCheck = await pool.query(
      "SELECT p.user_id FROM posts p WHERE p.id = $1 AND p.status = 'approved'",
      [postId]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found or not available for comments' });
    }

    // Block check — prevent commenting on blocker's posts
    const blocked = await pool.query(
      'SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
      [postCheck.rows[0].user_id, req.user!.id]
    );
    if (blocked.rows.length > 0) return res.status(403).json({ message: 'Cannot comment on this post' });

    const sanitizedBody = sanitizeText(body.trim());
    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
      [postId, req.user!.id, sanitizedBody]
    );

    // Create notification (skip self-comment)
    const ownerId = postCheck.rows[0].user_id;
    if (ownerId !== req.user!.id) {
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id) VALUES ($1, $2, $3, $4, $5)',
        [ownerId, req.user!.id, 'comment', postId, result.rows[0].id]
      ).catch(() => {});
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// GET /api/posts/:id/comments
router.get('/:id/comments', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1 ORDER BY c.created_at DESC LIMIT 100`,
      [postId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// PUT /api/posts/:postId/comments/:commentId — Edit a comment (owner only)
router.put('/:postId/comments/:commentId', validateComment, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.postId));
  const commentId = parseInt(String(req.params.commentId));
  if (isNaN(postId) || isNaN(commentId)) return res.status(400).json({ message: 'Invalid IDs' });
  const { body } = req.body;
  try {
    const sanitizedBody = sanitizeText(body.trim());
    const result = await pool.query(
      `UPDATE comments SET body = $1, is_edited = true WHERE id = $2 AND post_id = $3 AND user_id = $4 RETURNING *`,
      [sanitizedBody, commentId, postId, req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Comment not found or not yours' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to edit comment' });
  }
});

// DELETE /api/posts/:postId/comments/:commentId — Delete a comment (owner or post owner)
router.delete('/:postId/comments/:commentId', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.postId));
  const commentId = parseInt(String(req.params.commentId));
  if (isNaN(postId) || isNaN(commentId)) return res.status(400).json({ message: 'Invalid IDs' });
  try {
    // Allow deletion by comment owner OR post owner
    const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1 AND post_id = $2', [commentId, postId]);
    if (comment.rows.length === 0) return res.status(404).json({ message: 'Comment not found' });
    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (comment.rows[0].user_id !== req.user!.id && post.rows[0]?.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// DELETE /api/posts/:id — decrements hashtag counts + removes media from Cloudinary
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  try {
    // Verify ownership FIRST, then decrement hashtag counts
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id, image_url',
      [postId, req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Post not found or unauthorized' });

    // Decrement hashtag counts AFTER confirmed deletion
    await pool.query(
      `UPDATE hashtags SET post_count = GREATEST(post_count - 1, 0)
       WHERE id IN (SELECT hashtag_id FROM post_hashtags WHERE post_id = $1)`,
      [postId]
    );

    // Delete media from Cloudinary (non-blocking — won't fail the request)
    const imageUrl = result.rows[0].image_url;
    if (imageUrl) {
      deleteFromCloudinary(imageUrl);
    }

    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

// PUT /api/posts/:id — Edit post caption (owner only)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });
  const { caption } = req.body;
  if (caption === undefined) return res.status(400).json({ message: 'Caption required' });
  if (typeof caption === 'string' && caption.length > 2200) return res.status(400).json({ message: 'Caption too long (max 2200)' });

  try {
    const post = await pool.query('SELECT user_id, caption FROM posts WHERE id = $1', [postId]);
    if (!post.rows.length || post.rows[0].user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not your post' });
    }

    const sanitized = caption ? sanitizeText(caption.trim()) : null;
    const updated = await pool.query(
      `UPDATE posts SET caption = $1, is_edited = true, edited_at = NOW() WHERE id = $2 RETURNING *`,
      [sanitized, postId]
    );

    // Re-extract hashtags: remove old, add new
    await pool.query(
      `UPDATE hashtags SET post_count = GREATEST(post_count - 1, 0)
       WHERE id IN (SELECT hashtag_id FROM post_hashtags WHERE post_id = $1)`,
      [postId]
    );
    await pool.query('DELETE FROM post_hashtags WHERE post_id = $1', [postId]);
    const hashtags = extractHashtags(sanitized || '');
    for (const tag of hashtags) {
      const hashtagResult = await pool.query(
        `INSERT INTO hashtags (tag, post_count) VALUES ($1, 1)
         ON CONFLICT (tag) DO UPDATE SET post_count = hashtags.post_count + 1, last_used_at = NOW()
         RETURNING id`,
        [tag]
      );
      await pool.query(
        'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [postId, hashtagResult.rows[0].id]
      );
    }

    res.json({ post: updated.rows[0] });
  } catch (error) {
    console.error('Post edit error:', error);
    res.status(500).json({ message: 'Failed to edit post' });
  }
});

// ──────────────────────────────────────────────────────────
// CONTENT PROTECTION ENDPOINTS
// ──────────────────────────────────────────────────────────

// POST /api/posts/:id/screenshot-report — Log screenshot attempt (public + private)
router.post('/:id/screenshot-report', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });

  try {
    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ message: 'Post not found' });

    const ownerId = post.rows[0].user_id;
    if (ownerId === req.user!.id) return res.json({ ok: true });

    await pool.query(
      `INSERT INTO content_interactions (user_id, post_id, owner_id, action_type, metadata)
       VALUES ($1, $2, $3, 'screenshot_attempt', $4)
       ON CONFLICT ON CONSTRAINT unique_user_post_action DO NOTHING`,
      [req.user!.id, postId, ownerId, JSON.stringify({ timestamp: new Date().toISOString() })]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to report' });
  }
});

// POST /api/posts/:id/screenshot-request — Request permission (private only)
router.post('/:id/screenshot-request', async (req: AuthRequest, res: Response) => {
  const postId = parseInt(String(req.params.id));
  if (isNaN(postId)) return res.status(400).json({ message: 'Invalid post ID' });

  try {
    const post = await pool.query(
      'SELECT p.user_id, u.is_private FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1',
      [postId]
    );
    if (post.rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    if (!post.rows[0].is_private) return res.status(400).json({ message: 'Not a private account post' });

    const ownerId = post.rows[0].user_id;
    if (ownerId === req.user!.id) return res.json({ status: 'granted', granted_until: null });

    // Check active decline block
    const blocked = await pool.query(
      `SELECT blocked_until FROM screenshot_permissions
       WHERE requester_id = $1 AND post_id = $2 AND status = 'declined'
       AND blocked_until > NOW() ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, postId]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({
        message: 'Screenshot request was declined',
        blocked_until: blocked.rows[0].blocked_until
      });
    }

    // Check active grant
    const granted = await pool.query(
      `SELECT granted_until FROM screenshot_permissions
       WHERE requester_id = $1 AND post_id = $2 AND status = 'granted'
       AND granted_until > NOW() ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, postId]
    );
    if (granted.rows.length > 0) {
      return res.json({ status: 'granted', granted_until: granted.rows[0].granted_until });
    }

    // Check existing pending request
    const pending = await pool.query(
      `SELECT id FROM screenshot_permissions
       WHERE requester_id = $1 AND post_id = $2 AND status = 'pending'`,
      [req.user!.id, postId]
    );
    if (pending.rows.length > 0) {
      return res.json({ status: 'pending', request_id: pending.rows[0].id });
    }

    // Compromised account check: >10 requests in last hour → suspicious
    const recentRequests = await pool.query(
      `SELECT COUNT(*)::int as count FROM screenshot_permissions
       WHERE requester_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [req.user!.id]
    );
    if (recentRequests.rows[0].count > 10) {
      return res.status(429).json({
        message: 'Too many screenshot requests. Your activity appears suspicious.'
      });
    }

    // Create the request
    const result = await pool.query(
      `INSERT INTO screenshot_permissions (requester_id, owner_id, post_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [req.user!.id, ownerId, postId]
    );

    // Notify the owner
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, post_id)
       VALUES ($1, $2, 'screenshot_request', $3)`,
      [ownerId, req.user!.id, postId]
    );

    res.json({ status: 'pending', request_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create screenshot request' });
  }
});

// POST /api/posts/screenshot-requests/:id/respond — Accept or decline
router.post('/screenshot-requests/:id/respond', async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(String(req.params.id));
  const { action } = req.body;
  if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

  try {
    const request = await pool.query(
      'SELECT * FROM screenshot_permissions WHERE id = $1 AND owner_id = $2 AND status = $3',
      [requestId, req.user!.id, 'pending']
    );
    if (request.rows.length === 0) return res.status(404).json({ message: 'Request not found or already responded' });

    const reqData = request.rows[0];

    if (action === 'accept') {
      const grantedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await pool.query(
        `UPDATE screenshot_permissions SET status = 'granted', granted_until = $1, responded_at = NOW()
         WHERE id = $2`,
        [grantedUntil, requestId]
      );

      // Log the grant
      await pool.query(
        `INSERT INTO content_interactions (user_id, post_id, owner_id, action_type)
         VALUES ($1, $2, $3, 'screenshot_granted')
         ON CONFLICT ON CONSTRAINT unique_user_post_action DO NOTHING`,
        [reqData.requester_id, reqData.post_id, req.user!.id]
      );

      res.json({ status: 'granted', granted_until: grantedUntil });
    } else {
      const blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        `UPDATE screenshot_permissions SET status = 'declined', blocked_until = $1, responded_at = NOW()
         WHERE id = $2`,
        [blockedUntil, requestId]
      );
      res.json({ status: 'declined', blocked_until: blockedUntil });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to respond to screenshot request' });
  }
});

export default router;