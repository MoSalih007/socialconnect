import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { messageRateLimit } from '../middleware/rateLimiter';

const router = Router();
router.use(verifyToken);

// Allowed reaction emojis (prevent abuse — only standard emoji reactions)
const ALLOWED_REACTIONS = [
  '❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥', '🎉', '💯',
  '👀', '🙏', '💀', '❤️‍🔥', '🥺', '😍', '🤣', '😭', '🤔', '👏',
];

/** Check if user has access to the message (is sender, receiver, or in the group) */
async function canAccessMessage(messageId: number, userId: number): Promise<boolean> {
  const msg = await pool.query(
    `SELECT m.sender_id, m.receiver_id, m.group_id
     FROM messages m WHERE m.id = $1`,
    [messageId]
  );

  if (msg.rows.length === 0) return false;
  const { sender_id, receiver_id, group_id } = msg.rows[0];

  // DM: must be sender or receiver
  if (!group_id) {
    return sender_id === userId || receiver_id === userId;
  }

  // Group: must be a member
  const membership = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [group_id, userId]
  );
  return membership.rows.length > 0;
}


// ─── POST /api/reactions/:messageId — Add a reaction ────────────────────────────

router.post('/:messageId', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const messageId = parseInt(String(req.params.messageId));
  const { emoji } = req.body;

  if (isNaN(messageId)) return res.status(400).json({ message: 'Invalid message ID' });
  if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) {
    return res.status(400).json({ message: 'Invalid reaction emoji' });
  }

  try {
    // Check message exists and is not deleted
    const msg = await pool.query(
      'SELECT id, is_deleted FROM messages WHERE id = $1',
      [messageId]
    );
    if (msg.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (msg.rows[0].is_deleted) {
      return res.status(400).json({ message: 'Cannot react to a deleted message' });
    }

    // Check access
    if (!(await canAccessMessage(messageId, req.user!.id))) {
      return res.status(403).json({ message: 'You cannot react to this message' });
    }

    // Atomic insert with count guard to prevent race condition
    // Uses a single query that only inserts if the user has fewer than 5 reactions
    const insertResult = await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji)
       SELECT $1, $2, $3
       WHERE (SELECT COUNT(*) FROM message_reactions WHERE message_id = $1 AND user_id = $2) < 5
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING
       RETURNING id`,
      [messageId, req.user!.id, emoji]
    );

    if (insertResult.rows.length === 0) {
      // Either duplicate or max reactions reached
      const count = await pool.query(
        'SELECT COUNT(*)::int AS count FROM message_reactions WHERE message_id = $1 AND user_id = $2',
        [messageId, req.user!.id]
      );
      if (count.rows[0].count >= 5) {
        return res.status(400).json({ message: 'Maximum 5 reactions per message' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Failed to add reaction' });
  }
});


// ─── DELETE /api/reactions/:messageId — Remove a reaction ───────────────────────

router.delete('/:messageId', async (req: AuthRequest, res: Response) => {
  const messageId = parseInt(String(req.params.messageId));
  const { emoji } = req.body;

  if (isNaN(messageId)) return res.status(400).json({ message: 'Invalid message ID' });
  if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

  try {
    await pool.query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, req.user!.id, emoji]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Failed to remove reaction' });
  }
});


// ─── GET /api/reactions/:messageId — Get reactions for a message ────────────────

router.get('/:messageId', async (req: AuthRequest, res: Response) => {
  const messageId = parseInt(String(req.params.messageId));
  if (isNaN(messageId)) return res.status(400).json({ message: 'Invalid message ID' });

  try {
    if (!(await canAccessMessage(messageId, req.user!.id))) {
      return res.status(403).json({ message: 'You cannot view this message' });
    }

    const result = await pool.query(
      `SELECT mr.emoji, mr.user_id, u.username, mr.created_at
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = $1
       ORDER BY mr.created_at ASC`,
      [messageId]
    );

    // Group by emoji for display
    const grouped: Record<string, { emoji: string; count: number; users: { user_id: number; username: string }[] }> = {};
    for (const row of result.rows) {
      if (!grouped[row.emoji]) {
        grouped[row.emoji] = { emoji: row.emoji, count: 0, users: [] };
      }
      grouped[row.emoji].count++;
      grouped[row.emoji].users.push({ user_id: row.user_id, username: row.username });
    }

    res.json(Object.values(grouped));
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ message: 'Failed to fetch reactions' });
  }
});


export default router;
