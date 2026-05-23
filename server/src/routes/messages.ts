import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { messageRateLimit } from '../middleware/rateLimiter';
import { validateMessage, validateRichMessage, validateVoiceMessage, handleValidationErrors } from '../middleware/validator';
import { encrypt, decrypt, dmContext } from '../utils/encryption';
import { v2 as cloudinary } from 'cloudinary';
import { deleteFromCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(verifyToken);

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Check if two users are blocking each other */
async function checkBlocked(userId: number, otherId: number): Promise<boolean> {
  const blocked = await pool.query(
    'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
    [userId, otherId]
  );
  return blocked.rows.length > 0;
}

/** Check receiver exists and is not banned */
async function checkReceiverExists(receiverId: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND (is_banned = false OR is_banned IS NULL)',
    [receiverId]
  );
  return result.rows.length > 0;
}

/** Validate URL against allowed domains (security — prevents XSS via malicious URLs) */
function isAllowedMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = [
      'res.cloudinary.com',
      'media.giphy.com',
      'media0.giphy.com',
      'media1.giphy.com',
      'media2.giphy.com',
      'media3.giphy.com',
      'media4.giphy.com',
      'i.giphy.com',
      'media.tenor.com',
      'c.tenor.com',
      'api.klipy.com',
      'cdn.klipy.com',
      'media.klipy.com',
    ];
    // Allow any subdomain of klipy.com or giphy.com
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'https:' &&
      (allowed.includes(hostname) ||
        hostname.endsWith('.giphy.com') ||
        hostname.endsWith('.tenor.com') ||
        hostname.endsWith('.klipy.com') ||
        hostname.endsWith('.cloudinary.com'))
    );
  } catch {
    return false;
  }
}

/** Sanitize text — strip HTML tags to prevent XSS (defense in depth) */
function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


// ─── POST /api/messages/send — Send a text message ──────────────────────────────

router.post('/send', messageRateLimit, validateMessage, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { receiver_id, content, reply_to_id } = req.body;

  if (!receiver_id) {
    return res.status(400).json({ message: 'Receiver ID is required' });
  }

  // Prevent self-messaging
  if (receiver_id === req.user!.id) {
    return res.status(400).json({ message: 'Cannot send messages to yourself' });
  }

  try {
    if (await checkBlocked(req.user!.id, receiver_id)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }
    if (!(await checkReceiverExists(receiver_id))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Validate reply_to_id if provided
    if (reply_to_id) {
      const replyMsg = await pool.query(
        `SELECT id FROM messages WHERE id = $1 AND is_deleted = false
         AND ((sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2))`,
        [reply_to_id, req.user!.id, receiver_id]
      );
      if (replyMsg.rows.length === 0) {
        return res.status(400).json({ message: 'Reply message not found' });
      }
    }

    const sanitized = sanitizeText(content);
    const ctx = dmContext(req.user!.id, receiver_id);
    const encrypted = encrypt(sanitized, ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, message_type, reply_to_id)
       VALUES ($1, $2, $3, 'text', $4) RETURNING *`,
      [req.user!.id, receiver_id, encrypted, reply_to_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});


// ─── POST /api/messages/send-rich — Send a GIF or sticker ───────────────────────

router.post('/send-rich', messageRateLimit, validateRichMessage, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { receiver_id, message_type, media_url } = req.body;

  if (!receiver_id) {
    return res.status(400).json({ message: 'Receiver ID is required' });
  }
  if (receiver_id === req.user!.id) {
    return res.status(400).json({ message: 'Cannot send messages to yourself' });
  }

  // Validate URL — only for GIFs (stickers are emoji text, not URLs)
  if (message_type === 'gif' && !isAllowedMediaUrl(media_url)) {
    return res.status(400).json({ message: 'Invalid or untrusted media URL' });
  }
  // Stickers: validate they're short text (emoji), not a long payload
  if (message_type === 'sticker' && media_url.length > 50) {
    return res.status(400).json({ message: 'Invalid sticker' });
  }

  try {
    if (await checkBlocked(req.user!.id, receiver_id)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }
    if (!(await checkReceiverExists(receiver_id))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const ctx = dmContext(req.user!.id, receiver_id);
    const placeholder = encrypt(`[${message_type}]`, ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, message_type, media_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.id, receiver_id, placeholder, message_type, media_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send rich message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});


// ─── POST /api/messages/send-voice — Send a voice message ───────────────────────

router.post('/send-voice', messageRateLimit, validateVoiceMessage, handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { receiver_id, audio_base64 } = req.body;

  if (!receiver_id) {
    return res.status(400).json({ message: 'Receiver ID is required' });
  }
  if (receiver_id === req.user!.id) {
    return res.status(400).json({ message: 'Cannot send messages to yourself' });
  }

  try {
    if (await checkBlocked(req.user!.id, receiver_id)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }
    if (!(await checkReceiverExists(receiver_id))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const uploadResult = await cloudinary.uploader.upload(audio_base64, {
      resource_type: 'video',
      folder: 'socialconnect/voice_messages',
      format: 'webm',
    });

    const ctx = dmContext(req.user!.id, receiver_id);
    const placeholder = encrypt('[voice]', ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, message_type, media_url)
       VALUES ($1, $2, $3, 'voice', $4) RETURNING *`,
      [req.user!.id, receiver_id, placeholder, uploadResult.secure_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send voice message error:', error);
    res.status(500).json({ message: 'Failed to send voice message' });
  }
});


// ─── POST /api/messages/send-image — Send an image attachment ───────────────────

router.post('/send-image', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const { receiver_id, image_base64 } = req.body;

  if (!receiver_id || !image_base64) {
    return res.status(400).json({ message: 'Receiver ID and image are required' });
  }
  if (receiver_id === req.user!.id) {
    return res.status(400).json({ message: 'Cannot send messages to yourself' });
  }

  // Strict MIME check — only allow actual images
  // SECURITY: svg+xml excluded — SVG files can contain JavaScript (XSS risk)
  if (!/^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(image_base64)) {
    return res.status(400).json({ message: 'Invalid image format. Allowed: jpeg, png, gif, webp' });
  }

  // Size check (5MB max)
  const sizeInBytes = (image_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image must be under 5MB' });
  }

  try {
    if (await checkBlocked(req.user!.id, receiver_id)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }
    if (!(await checkReceiverExists(receiver_id))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const uploadResult = await cloudinary.uploader.upload(image_base64, {
      folder: 'socialconnect/chat_images',
      resource_type: 'image',
      transformation: [
        { quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' }
      ],
    });

    const ctx = dmContext(req.user!.id, receiver_id);
    const placeholder = encrypt('[image]', ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, message_type, media_url)
       VALUES ($1, $2, $3, 'image', $4) RETURNING *`,
      [req.user!.id, receiver_id, placeholder, uploadResult.secure_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send image message error:', error);
    res.status(500).json({ message: 'Failed to send image' });
  }
});


// ─── GET /api/messages/conversations — List all DM conversations ────────────────

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_id)
         other_id,
         u.username,
         u.avatar_url,
         u.full_name,
         u.last_active,
         u.show_online_status,
         u.show_last_seen,
         last_msg.created_at   AS last_message_at,
         last_msg.encrypted_content,
         last_msg.message_type AS last_msg_type,
         last_msg.sender_id    AS last_msg_sender_id,
         last_msg.is_deleted   AS last_msg_is_deleted
       FROM (
         SELECT
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id,
           encrypted_content, message_type, sender_id, is_deleted, created_at
         FROM messages
         WHERE (sender_id = $1 OR receiver_id = $1)
           AND group_id IS NULL
       ) AS last_msg
       JOIN users u ON u.id = last_msg.other_id
       WHERE last_msg.other_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ORDER BY other_id, last_msg.created_at DESC`,
      [req.user!.id]
    );

    // Compute unread counts
    const unreadResult = await pool.query(
      `SELECT sender_id, COUNT(*)::int AS unread
       FROM messages
       WHERE receiver_id = $1 AND read_at IS NULL AND is_deleted = false AND group_id IS NULL
       GROUP BY sender_id`,
      [req.user!.id]
    );
    const unreadMap: Record<number, number> = {};
    for (const row of unreadResult.rows) {
      unreadMap[row.sender_id] = row.unread;
    }

    const sorted = result.rows
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      .map(row => {
        // Decrypt last message for preview
        let lastMessage = '';
        if (row.last_msg_is_deleted) {
          lastMessage = 'This message was deleted';
        } else if (row.last_msg_type === 'text' || !row.last_msg_type) {
          try {
            const ctx = dmContext(req.user!.id, row.other_id);
            lastMessage = decrypt(row.encrypted_content, ctx);
          } catch { lastMessage = ''; }
        } else {
          const typeLabels: Record<string, string> = { image: '📷 Photo', voice: '🎤 Voice', gif: 'GIF', sticker: '🎨 Sticker' };
          lastMessage = typeLabels[row.last_msg_type] || row.last_msg_type;
        }

        return {
          other_id: row.other_id,
          username: row.username,
          avatar_url: row.avatar_url,
          full_name: row.full_name,
          last_message: lastMessage,
          last_message_at: row.last_message_at,
          last_msg_sender_id: row.last_msg_sender_id,
          unread_count: unreadMap[row.other_id] || 0,
          is_online: row.show_online_status && row.last_active && (Date.now() - new Date(row.last_active).getTime()) < 5 * 60 * 1000,
          last_seen: row.show_last_seen ? row.last_active : null,
        };
      });

    res.json(sorted);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});


// ─── GET /api/messages/thread/:otherId — Get paginated DM thread ────────────────

router.get('/thread/:otherId', async (req: AuthRequest, res: Response) => {
  const otherId = parseInt(String(req.params.otherId));
  if (isNaN(otherId)) return res.status(400).json({ message: 'Invalid user ID' });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  try {
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM messages
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND group_id IS NULL`,
      [req.user!.id, otherId]
    );

    const result = await pool.query(
      `SELECT m.*,
              r.id AS reply_msg_id,
              r.encrypted_content AS reply_content,
              r.message_type AS reply_type,
              r.sender_id AS reply_sender_id,
              r.is_deleted AS reply_is_deleted
       FROM messages m
       LEFT JOIN messages r ON m.reply_to_id = r.id
       WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
         AND m.group_id IS NULL
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user!.id, otherId, limit, offset]
    );

    // Decrypt and assemble messages (reverse to chronological after LIMIT)
    const ctx = dmContext(req.user!.id, otherId);
    const messages = result.rows.reverse().map(msg => {
      const decrypted = (msg.message_type === 'text' || !msg.message_type)
        ? decrypt(msg.encrypted_content, ctx)
        : msg.encrypted_content;

      // Decrypt reply preview
      let replyPreview = null;
      if (msg.reply_msg_id) {
        replyPreview = {
          id: msg.reply_msg_id,
          sender_id: msg.reply_sender_id,
          message_type: msg.reply_type,
          is_deleted: msg.reply_is_deleted,
          content: msg.reply_is_deleted
            ? 'This message was deleted'
            : (msg.reply_type === 'text' || !msg.reply_type)
              ? decrypt(msg.reply_content, ctx)
              : `[${msg.reply_type}]`,
        };
      }

      return {
        ...msg,
        encrypted_content: decrypted,
        reply_preview: replyPreview,
        // Clean up joined columns
        reply_content: undefined,
        reply_type: undefined,
        reply_sender_id: undefined,
        reply_msg_id: undefined,
        reply_is_deleted: undefined,
      };
    });

    // Fetch reactions for these messages in one query
    const msgIds = messages.map(m => m.id);
    let reactions: Record<number, any[]> = {};
    if (msgIds.length > 0) {
      const reactResult = await pool.query(
        `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
         FROM message_reactions mr
         JOIN users u ON u.id = mr.user_id
         WHERE mr.message_id = ANY($1)
         ORDER BY mr.created_at ASC`,
        [msgIds]
      );
      for (const r of reactResult.rows) {
        if (!reactions[r.message_id]) reactions[r.message_id] = [];
        reactions[r.message_id].push({ emoji: r.emoji, user_id: r.user_id, username: r.username });
      }
    }

    // Attach reactions to messages
    for (const msg of messages) {
      msg.reactions = reactions[msg.id] || [];
    }

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});


// ─── PUT /api/messages/read/:otherId — Mark all unread as read ──────────────────

router.put('/read/:otherId', async (req: AuthRequest, res: Response) => {
  const otherId = parseInt(String(req.params.otherId));
  if (isNaN(otherId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL AND group_id IS NULL`,
      [otherId, req.user!.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});


// ─── PUT /api/messages/edit/:id — Edit a message (sender only, 15 min window) ───

router.put('/edit/:id', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const messageId = parseInt(String(req.params.id));
  const { content } = req.body;

  if (isNaN(messageId)) return res.status(400).json({ message: 'Invalid message ID' });
  if (!content || content.trim().length === 0) return res.status(400).json({ message: 'Content is required' });
  if (content.length > 1000) return res.status(400).json({ message: 'Message too long (max 1000 chars)' });

  try {
    // Check message exists, is by sender, is text, and within 15 min window
    const msg = await pool.query(
      `SELECT * FROM messages WHERE id = $1 AND sender_id = $2`,
      [messageId, req.user!.id]
    );

    if (msg.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found or you are not the sender' });
    }

    const message = msg.rows[0];

    if (message.is_deleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted message' });
    }

    if (message.message_type !== 'text') {
      return res.status(400).json({ message: 'Only text messages can be edited' });
    }

    // 15-minute edit window
    const ageMs = Date.now() - new Date(message.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) {
      return res.status(400).json({ message: 'Messages can only be edited within 15 minutes of sending' });
    }

    const ctx = dmContext(req.user!.id, message.receiver_id);
    const sanitized = sanitizeText(content.trim());
    const encrypted = encrypt(sanitized, ctx);

    await pool.query(
      `UPDATE messages SET encrypted_content = $1, is_edited = true, edited_at = NOW()
       WHERE id = $2`,
      [encrypted, messageId]
    );

    res.json({ success: true, message: 'Message edited' });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Failed to edit message' });
  }
});


// ─── DELETE /api/messages/delete/:id — Soft-delete a message ────────────────────

router.delete('/delete/:id', async (req: AuthRequest, res: Response) => {
  const messageId = parseInt(String(req.params.id));
  if (isNaN(messageId)) {
    return res.status(400).json({ message: 'Invalid message ID' });
  }

  try {
    // Check the message exists and belongs to sender
    const msgResult = await pool.query(
      'SELECT id, message_type, media_url, sender_id, receiver_id FROM messages WHERE id = $1 AND sender_id = $2',
      [messageId, req.user!.id]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found or you are not the sender' });
    }

    const deletedMsg = msgResult.rows[0];

    // Soft-delete the message
    const delCtx = dmContext(req.user!.id, deletedMsg.receiver_id || deletedMsg.sender_id);
    await pool.query(
      `UPDATE messages SET is_deleted = true, deleted_at = NOW(), encrypted_content = $1, media_url = NULL
       WHERE id = $2`,
      [encrypt('[deleted]', delCtx), messageId]
    );

    // Clean up Cloudinary assets (voice, image uploads — NOT GIFs/stickers which are external URLs)
    if (['voice', 'image'].includes(deletedMsg.message_type) && deletedMsg.media_url) {
      // Only delete if it's a Cloudinary URL (our own uploads)
      if (deletedMsg.media_url.includes('res.cloudinary.com')) {
        deleteFromCloudinary(deletedMsg.media_url);
      }
    }

    // Also delete any reactions for this message
    await pool.query('DELETE FROM message_reactions WHERE message_id = $1', [messageId]);

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});


// ─── POST /api/messages/typing/:otherId — Typing indicator ─────────────────────

// In-memory typing state (lightweight — no DB writes, no Cloudinary cost)
const typingState: Record<string, number> = {}; // key: "userId-otherId", value: timestamp

// Periodic cleanup to prevent memory leaks (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  const keys = Object.keys(typingState);
  for (const key of keys) {
    if (now - typingState[key] > 10000) delete typingState[key];
  }
  // Hard cap: if somehow exceeds 1000 entries, purge oldest half
  if (Object.keys(typingState).length > 1000) {
    const sorted = Object.entries(typingState).sort((a, b) => a[1] - b[1]);
    sorted.slice(0, 500).forEach(([k]) => delete typingState[k]);
  }
}, 30000);

router.post('/typing/:otherId', async (req: AuthRequest, res: Response) => {
  const otherId = parseInt(String(req.params.otherId));
  if (isNaN(otherId)) return res.status(400).json({ message: 'Invalid user ID' });
  typingState[`${req.user!.id}-${otherId}`] = Date.now();
  res.json({ success: true });
});

router.get('/typing-status/:otherId', async (req: AuthRequest, res: Response) => {
  const otherId = parseInt(String(req.params.otherId));
  if (isNaN(otherId)) return res.status(400).json({ message: 'Invalid user ID' });

  const key = `${otherId}-${req.user!.id}`;
  const lastTyping = typingState[key];
  // Typing is "active" if it was within the last 4 seconds
  const isTyping = lastTyping ? (Date.now() - lastTyping) < 4000 : false;

  // Clean up old entries
  if (lastTyping && !isTyping) {
    delete typingState[key];
  }

  res.json({ isTyping });
});


// ─── LEGACY: GET /api/messages/:otherId — Backwards compatibility ───────────────
// Redirects to the new paginated endpoint to avoid breaking existing clients

router.get('/:otherId', async (req: AuthRequest, res: Response) => {
  const otherId = parseInt(String(req.params.otherId));
  if (isNaN(otherId)) return res.status(400).json({ message: 'Invalid user ID' });

  // Use the same logic as thread endpoint but return flat array for compatibility
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT * FROM messages
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND group_id IS NULL
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user!.id, otherId, limit, offset]
    );

    const ctx = dmContext(req.user!.id, otherId);
    const messages = result.rows.reverse().map(msg => ({
      ...msg,
      encrypted_content: (msg.message_type === 'text' || !msg.message_type)
        ? decrypt(msg.encrypted_content, ctx)
        : msg.encrypted_content,
    }));

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});


export default router;