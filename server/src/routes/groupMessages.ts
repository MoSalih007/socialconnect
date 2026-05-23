import { Router, Response } from 'express';
import pool from '../config/db';
import { AuthRequest, verifyToken } from '../middleware/auth';
import { messageRateLimit, groupCreationRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validator';
import { encrypt, decrypt, groupContext } from '../utils/encryption';
import { body } from 'express-validator';
import { v2 as cloudinary } from 'cloudinary';
import { deleteFromCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(verifyToken);

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function isMember(groupId: number, userId: number): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  return r.rows.length > 0;
}

async function isAdmin(groupId: number, userId: number): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`, [groupId, userId]);
  return r.rows.length > 0;
}

async function isCreator(groupId: number, userId: number): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM group_conversations WHERE id = $1 AND created_by = $2', [groupId, userId]);
  return r.rows.length > 0;
}

async function checkBlocked(a: number, b: number): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)', [a, b]);
  return r.rows.length > 0;
}

function sanitizeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function isAllowedMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (hostname.endsWith('.cloudinary.com') || hostname.endsWith('.giphy.com') || hostname.endsWith('.tenor.com') || hostname.endsWith('.klipy.com'));
  } catch { return false; }
}

const groupTypingState: Record<string, { userId: number; username: string; ts: number }[]> = {};

// Periodic cleanup to prevent memory leaks (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(groupTypingState)) {
    groupTypingState[key] = groupTypingState[key].filter(t => now - t.ts < 10000);
    if (groupTypingState[key].length === 0) delete groupTypingState[key];
  }
}, 30000);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUP CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post('/', groupCreationRateLimit, [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Group name is required (max 100 chars)'),
  body('description').optional().isLength({ max: 500 }),
  body('member_ids').optional().isArray({ max: 49 }).withMessage('Max 49 initial members'),
], handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const { name, description, member_ids } = req.body;
  const sanitizedName = sanitizeText(name.trim());
  try {
    const groupResult = await pool.query(
      `INSERT INTO group_conversations (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [sanitizedName, description ? sanitizeText(description.trim()) : null, req.user!.id]
    );
    const group = groupResult.rows[0];
    await pool.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`, [group.id, req.user!.id]);

    if (member_ids && Array.isArray(member_ids)) {
      const uniqueIds = [...new Set(member_ids.filter((id: number) => id !== req.user!.id))];
      for (const memberId of uniqueIds) {
        if (await checkBlocked(req.user!.id, memberId as number)) continue;
        const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [memberId]);
        if (userExists.rows.length === 0) continue;
        await pool.query(
          `INSERT INTO group_invitations (group_id, inviter_id, invitee_id) VALUES ($1, $2, $3) ON CONFLICT (group_id, invitee_id) DO NOTHING`,
          [group.id, req.user!.id, memberId]
        );
      }
    }
    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT gc.*, gm.role AS my_role, gm.is_muted AS my_muted,
              (SELECT COUNT(*)::int FROM group_members WHERE group_id = gc.id) AS member_count,
              (SELECT m.encrypted_content FROM messages m WHERE m.group_id = gc.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_encrypted,
              (SELECT m.message_type FROM messages m WHERE m.group_id = gc.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_type,
              (SELECT m.is_deleted FROM messages m WHERE m.group_id = gc.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_deleted,
              (SELECT u.username FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.group_id = gc.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_sender,
              (SELECT m.created_at FROM messages m WHERE m.group_id = gc.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*)::int FROM messages m WHERE m.group_id = gc.id AND m.created_at > gm.last_read_at AND m.sender_id != $1 AND m.is_deleted = false) AS unread_count
       FROM group_conversations gc
       JOIN group_members gm ON gm.group_id = gc.id AND gm.user_id = $1
       ORDER BY last_message_at DESC NULLS LAST, gc.created_at DESC`,
      [req.user!.id]
    );

    const groups = result.rows.map((row: any) => {
      let lastMessage = '';
      if (row.last_msg_deleted) {
        lastMessage = 'This message was deleted';
      } else if (row.last_msg_encrypted) {
        if (row.last_msg_type === 'text' || !row.last_msg_type) {
          try { lastMessage = decrypt(row.last_msg_encrypted, groupContext(row.id)); } catch {
            try { lastMessage = decrypt(row.last_msg_encrypted); } catch { lastMessage = ''; }
          }
        } else {
          const labels: Record<string, string> = { image: '📷 Photo', voice: '🎤 Voice', gif: 'GIF', sticker: '🎨 Sticker' };
          lastMessage = labels[row.last_msg_type] || row.last_msg_type;
        }
      }
      return {
        id: row.id, name: row.name, description: row.description, avatar_url: row.avatar_url,
        created_by: row.created_by, member_count: row.member_count, my_role: row.my_role,
        my_muted: row.my_muted, is_muted_all: row.is_muted_all, last_message: lastMessage,
        last_message_at: row.last_message_at, last_msg_sender: row.last_msg_sender,
        unread_count: row.unread_count, created_at: row.created_at,
      };
    });
    res.json(groups);
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

router.get('/invitations/pending', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT gi.*, gc.name AS group_name, gc.avatar_url AS group_avatar,
              gc.description AS group_description,
              u.username AS inviter_username, u.avatar_url AS inviter_avatar,
              (SELECT COUNT(*)::int FROM group_members WHERE group_id = gc.id) AS member_count
       FROM group_invitations gi
       JOIN group_conversations gc ON gc.id = gi.group_id
       JOIN users u ON u.id = gi.inviter_id
       WHERE gi.invitee_id = $1 AND gi.status = 'pending'
       ORDER BY gi.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ message: 'Failed to fetch invitations' });
  }
});

router.post('/invitations/:id/respond', async (req: AuthRequest, res: Response) => {
  const invitationId = parseInt(String(req.params.id));
  const { action } = req.body;
  if (isNaN(invitationId)) return res.status(400).json({ message: 'Invalid invitation ID' });
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ message: 'Action must be accept or decline' });

  try {
    const inv = await pool.query(`SELECT * FROM group_invitations WHERE id = $1 AND invitee_id = $2 AND status = 'pending'`, [invitationId, req.user!.id]);
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invitation not found' });
    const invitation = inv.rows[0];

    if (action === 'accept') {
      const memberCount = await pool.query('SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1', [invitation.group_id]);
      const group = await pool.query('SELECT max_members FROM group_conversations WHERE id = $1', [invitation.group_id]);
      if (memberCount.rows[0].count >= (group.rows[0]?.max_members || 50)) {
        return res.status(400).json({ message: 'Group is full' });
      }
      await pool.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (group_id, user_id) DO NOTHING`, [invitation.group_id, req.user!.id]);
    }

    await pool.query(`UPDATE group_invitations SET status = $1, responded_at = NOW() WHERE id = $2`, [action === 'accept' ? 'accepted' : 'declined', invitationId]);
    res.json({ success: true, action });
  } catch (error) {
    console.error('Respond invitation error:', error);
    res.status(500).json({ message: 'Failed to respond to invitation' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const groupResult = await pool.query(
      `SELECT gc.*, (SELECT COUNT(*)::int FROM group_members WHERE group_id = gc.id) AS member_count FROM group_conversations gc WHERE gc.id = $1`, [groupId]
    );
    if (groupResult.rows.length === 0) return res.status(404).json({ message: 'Group not found' });
    const membersResult = await pool.query(
      `SELECT gm.*, u.username, u.avatar_url, u.full_name, u.last_active, u.show_online_status
       FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY gm.role DESC, gm.joined_at ASC`, [groupId]
    );
    const group = groupResult.rows[0];
    group.members = membersResult.rows.map((m: any) => ({
      user_id: m.user_id, username: m.username, avatar_url: m.avatar_url, full_name: m.full_name,
      role: m.role, nickname: m.nickname, is_muted: m.is_muted, joined_at: m.joined_at,
      is_online: m.show_online_status && m.last_active && (Date.now() - new Date(m.last_active).getTime()) < 5 * 60 * 1000,
    }));
    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

router.put('/:id', [body('name').optional().isLength({ min: 1, max: 100 }), body('description').optional().isLength({ max: 500 })], handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can update group settings' });
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (req.body.name) { updates.push(`name = $${paramIdx++}`); values.push(sanitizeText(req.body.name.trim())); }
    if (req.body.description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(req.body.description ? sanitizeText(req.body.description.trim()) : null); }
    if (updates.length === 0) return res.status(400).json({ message: 'No updates provided' });
    updates.push(`updated_at = NOW()`);
    values.push(groupId);
    const result = await pool.query(`UPDATE group_conversations SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isCreator(groupId, req.user!.id))) return res.status(403).json({ message: 'Only the group creator can delete it' });
    const mediaMessages = await pool.query(
      `SELECT media_url, message_type FROM messages WHERE group_id = $1 AND media_url IS NOT NULL AND media_url LIKE '%res.cloudinary.com%'`, [groupId]
    );
    for (const msg of mediaMessages.rows) {
      if (['voice', 'image'].includes(msg.message_type)) deleteFromCloudinary(msg.media_url);
    }
    const group = await pool.query('SELECT avatar_url FROM group_conversations WHERE id = $1', [groupId]);
    if (group.rows[0]?.avatar_url?.includes('res.cloudinary.com')) deleteFromCloudinary(group.rows[0].avatar_url);
    await pool.query('DELETE FROM group_conversations WHERE id = $1', [groupId]);
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUP MESSAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const pg = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (pg - 1) * limit;

  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const ctx = groupContext(groupId);
    const blockedResult = await pool.query(
      `SELECT blocked_id FROM blocks WHERE blocker_id = $1 UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1`, [req.user!.id]
    );
    const blockedIds = blockedResult.rows.map((r: any) => r.blocked_id);
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM messages WHERE group_id = $1', [groupId]);
    const result = await pool.query(
      `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar,
              r.id AS reply_msg_id, r.encrypted_content AS reply_content, r.message_type AS reply_type,
              r.sender_id AS reply_sender_id, r.is_deleted AS reply_is_deleted, ru.username AS reply_sender_username
       FROM messages m JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages r ON m.reply_to_id = r.id LEFT JOIN users ru ON r.sender_id = ru.id
       WHERE m.group_id = $1 ORDER BY m.created_at DESC LIMIT $2 OFFSET $3`, [groupId, limit, offset]
    );

    const messages = result.rows.reverse().map((msg: any) => {
      const isBlocked = blockedIds.includes(msg.sender_id);
      const decrypted = msg.is_deleted ? '[deleted]' : isBlocked ? '[hidden]'
        : (msg.message_type === 'text' || !msg.message_type) ? decrypt(msg.encrypted_content, ctx) : msg.encrypted_content;

      let replyPreview = null;
      if (msg.reply_msg_id) {
        replyPreview = {
          id: msg.reply_msg_id, sender_id: msg.reply_sender_id, sender_username: msg.reply_sender_username,
          message_type: msg.reply_type, is_deleted: msg.reply_is_deleted,
          content: msg.reply_is_deleted ? 'This message was deleted'
            : (msg.reply_type === 'text' || !msg.reply_type) ? decrypt(msg.reply_content, ctx) : `[${msg.reply_type}]`,
        };
      }

      return {
        id: msg.id, sender_id: msg.sender_id, sender_username: isBlocked ? 'Blocked User' : msg.sender_username,
        sender_avatar: isBlocked ? null : msg.sender_avatar, group_id: msg.group_id,
        encrypted_content: decrypted, message_type: msg.message_type,
        media_url: (msg.is_deleted || isBlocked) ? null : msg.media_url,
        is_edited: msg.is_edited, is_deleted: msg.is_deleted, is_blocked: isBlocked,
        reply_to_id: msg.reply_to_id, reply_preview: replyPreview, created_at: msg.created_at,
        reactions: [] as any[],
      };
    });

    const msgIds = messages.map((m: any) => m.id);
    if (msgIds.length > 0) {
      const reactResult = await pool.query(
        `SELECT mr.message_id, mr.emoji, mr.user_id, u.username FROM message_reactions mr JOIN users u ON u.id = mr.user_id WHERE mr.message_id = ANY($1) ORDER BY mr.created_at ASC`, [msgIds]
      );
      const reactionsMap: Record<number, any[]> = {};
      for (const r of reactResult.rows) {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
        reactionsMap[r.message_id].push({ emoji: r.emoji, user_id: r.user_id, username: r.username });
      }
      for (const msg of messages) { msg.reactions = reactionsMap[msg.id] || []; }
    }

    res.json({ messages, pagination: { page: pg, limit, total: countResult.rows[0].total, totalPages: Math.ceil(countResult.rows[0].total / limit) } });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

router.post('/:id/messages', messageRateLimit, [body('content').isLength({ min: 1, max: 1000 }).withMessage('Message 1-1000 chars')], handleValidationErrors, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const { content, reply_to_id } = req.body;
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const group = await pool.query('SELECT is_muted_all FROM group_conversations WHERE id = $1', [groupId]);
    if (group.rows[0]?.is_muted_all && !(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can send messages when mute-all is enabled' });
    if (reply_to_id) {
      const replyMsg = await pool.query('SELECT id FROM messages WHERE id = $1 AND group_id = $2 AND is_deleted = false', [reply_to_id, groupId]);
      if (replyMsg.rows.length === 0) return res.status(400).json({ message: 'Reply message not found' });
    }
    const ctx = groupContext(groupId);
    const sanitized = sanitizeText(content.trim());
    const encrypted = encrypt(sanitized, ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, encrypted_content, message_type, group_id, reply_to_id) VALUES ($1, $2, 'text', $3, $4) RETURNING *`,
      [req.user!.id, encrypted, groupId, reply_to_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

router.post('/:id/messages/image', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ message: 'Image is required' });
  if (!/^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(image_base64)) return res.status(400).json({ message: 'Invalid image format' });
  const sizeInBytes = (image_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) return res.status(400).json({ message: 'Image must be under 5MB' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const group = await pool.query('SELECT is_muted_all FROM group_conversations WHERE id = $1', [groupId]);
    if (group.rows[0]?.is_muted_all && !(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can send when mute-all is enabled' });
    const uploadResult = await cloudinary.uploader.upload(image_base64, { folder: 'socialconnect/group_images', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' as const }] });
    const ctx = groupContext(groupId);
    const placeholder = encrypt('[image]', ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, encrypted_content, message_type, media_url, group_id) VALUES ($1, $2, 'image', $3, $4) RETURNING *`,
      [req.user!.id, placeholder, uploadResult.secure_url, groupId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send group image error:', error);
    res.status(500).json({ message: 'Failed to send image' });
  }
});

router.post('/:id/messages/rich', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const { message_type, media_url } = req.body;
  if (!['gif', 'sticker'].includes(message_type)) return res.status(400).json({ message: 'message_type must be gif or sticker' });
  if (!media_url) return res.status(400).json({ message: 'media_url is required' });
  // Validate URL — only for GIFs (stickers are emoji text, not URLs)
  if (message_type === 'gif' && !isAllowedMediaUrl(media_url)) return res.status(400).json({ message: 'Invalid or untrusted media URL' });
  // Stickers: validate they're short text (emoji), not a long payload
  if (message_type === 'sticker' && media_url.length > 50) return res.status(400).json({ message: 'Invalid sticker' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const group = await pool.query('SELECT is_muted_all FROM group_conversations WHERE id = $1', [groupId]);
    if (group.rows[0]?.is_muted_all && !(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can send when mute-all is enabled' });
    const ctx = groupContext(groupId);
    const placeholder = encrypt(`[${message_type}]`, ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, encrypted_content, message_type, media_url, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.id, placeholder, message_type, media_url, groupId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send group rich error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

router.post('/:id/messages/voice', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const { audio_base64 } = req.body;
  if (!audio_base64?.startsWith('data:audio/')) return res.status(400).json({ message: 'Invalid audio format' });
  const sizeInBytes = (audio_base64.split(',')[1]?.length || 0) * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) return res.status(400).json({ message: 'Voice message must be under 5MB' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const group = await pool.query('SELECT is_muted_all FROM group_conversations WHERE id = $1', [groupId]);
    if (group.rows[0]?.is_muted_all && !(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can send when mute-all is enabled' });
    const uploadResult = await cloudinary.uploader.upload(audio_base64, { resource_type: 'video', folder: 'socialconnect/group_voice', format: 'webm' });
    const ctx = groupContext(groupId);
    const placeholder = encrypt('[voice]', ctx);
    const result = await pool.query(
      `INSERT INTO messages (sender_id, encrypted_content, message_type, media_url, group_id) VALUES ($1, $2, 'voice', $3, $4) RETURNING *`,
      [req.user!.id, placeholder, uploadResult.secure_url, groupId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send group voice error:', error);
    res.status(500).json({ message: 'Failed to send voice' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMBER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const result = await pool.query(
      `SELECT gm.user_id, gm.role, gm.nickname, gm.is_muted, gm.joined_at,
              u.username, u.avatar_url, u.full_name, u.last_active, u.show_online_status
       FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY gm.role DESC, gm.joined_at ASC`, [groupId]
    );
    const members = result.rows.map((m: any) => ({
      ...m, is_online: m.show_online_status && m.last_active && (Date.now() - new Date(m.last_active).getTime()) < 5 * 60 * 1000,
    }));
    res.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
});

router.post('/:id/invite', messageRateLimit, async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  const { user_ids } = req.body;
  if (!Array.isArray(user_ids) || user_ids.length === 0) return res.status(400).json({ message: 'user_ids array is required' });
  if (user_ids.length > 20) return res.status(400).json({ message: 'Cannot invite more than 20 users at once' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(403).json({ message: 'You are not a member of this group' });
    const memberCount = await pool.query('SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1', [groupId]);
    const group = await pool.query('SELECT max_members FROM group_conversations WHERE id = $1', [groupId]);
    const maxMembers = group.rows[0]?.max_members || 50;
    const pendingInvites = await pool.query(`SELECT COUNT(*)::int AS count FROM group_invitations WHERE group_id = $1 AND status = 'pending'`, [groupId]);
    if (memberCount.rows[0].count + pendingInvites.rows[0].count + user_ids.length > maxMembers) return res.status(400).json({ message: `Group would exceed max ${maxMembers} members` });
    const recentInvites = await pool.query(`SELECT COUNT(*)::int AS count FROM group_invitations WHERE inviter_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [req.user!.id]);
    if (recentInvites.rows[0].count >= 50) return res.status(429).json({ message: 'Too many invitations sent. Try again later.' });
    const invited: number[] = [];
    const failed: { userId: number; reason: string }[] = [];
    for (const userId of user_ids) {
      if (userId === req.user!.id) { failed.push({ userId, reason: 'Cannot invite yourself' }); continue; }
      const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userExists.rows.length === 0) { failed.push({ userId, reason: 'User not found' }); continue; }
      if (await checkBlocked(req.user!.id, userId)) { failed.push({ userId, reason: 'Blocked' }); continue; }
      if (await isMember(groupId, userId)) { failed.push({ userId, reason: 'Already a member' }); continue; }
      try {
        await pool.query(`INSERT INTO group_invitations (group_id, inviter_id, invitee_id) VALUES ($1, $2, $3) ON CONFLICT (group_id, invitee_id) DO NOTHING`, [groupId, req.user!.id, userId]);
        invited.push(userId);
      } catch { failed.push({ userId, reason: 'Already invited' }); }
    }
    res.json({ invited, failed });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ message: 'Failed to send invitations' });
  }
});

router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isMember(groupId, req.user!.id))) return res.status(400).json({ message: 'You are not a member of this group' });
    if (await isCreator(groupId, req.user!.id)) {
      const nextAdmin = await pool.query(`SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2 ORDER BY role DESC, joined_at ASC LIMIT 1`, [groupId, req.user!.id]);
      if (nextAdmin.rows.length > 0) {
        await pool.query(`UPDATE group_conversations SET created_by = $1 WHERE id = $2`, [nextAdmin.rows[0].user_id, groupId]);
        await pool.query(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, [groupId, nextAdmin.rows[0].user_id]);
      } else {
        // Clean up Cloudinary media before group deletion
        const mediaMessages = await pool.query(
          `SELECT media_url FROM messages WHERE group_id = $1 AND media_url IS NOT NULL`,
          [groupId]
        );
        for (const msg of mediaMessages.rows) {
          if (msg.media_url?.includes('res.cloudinary.com')) {
            deleteFromCloudinary(msg.media_url);
          }
        }
        await pool.query('DELETE FROM group_conversations WHERE id = $1', [groupId]);
        return res.json({ left: true, groupDeleted: true });
      }
    }
    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user!.id]);
    res.json({ left: true });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

router.delete('/:id/kick/:userId', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  const targetId = parseInt(String(req.params.userId));
  if (isNaN(groupId) || isNaN(targetId)) return res.status(400).json({ message: 'Invalid IDs' });
  try {
    if (!(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can kick members' });
    if (targetId === req.user!.id) return res.status(400).json({ message: 'Cannot kick yourself' });
    if (await isCreator(groupId, targetId)) return res.status(403).json({ message: 'Cannot kick the group creator' });
    const result = await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING user_id', [groupId, targetId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User is not a member' });
    res.json({ kicked: true });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ message: 'Failed to kick member' });
  }
});

router.put('/:id/role/:userId', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  const targetId = parseInt(String(req.params.userId));
  const { role } = req.body;
  if (isNaN(groupId) || isNaN(targetId)) return res.status(400).json({ message: 'Invalid IDs' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ message: 'Role must be admin or member' });
  try {
    if (!(await isCreator(groupId, req.user!.id))) return res.status(403).json({ message: 'Only the group creator can change roles' });
    if (targetId === req.user!.id) return res.status(400).json({ message: 'Cannot change your own role' });
    const result = await pool.query('UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3 RETURNING *', [role, groupId, targetId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User is not a member' });
    res.json({ updated: true, role });
  } catch (error) {
    console.error('Role change error:', error);
    res.status(500).json({ message: 'Failed to change role' });
  }
});

router.put('/:id/mute', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  const { muted } = req.body;
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    await pool.query('UPDATE group_members SET is_muted = $1 WHERE group_id = $2 AND user_id = $3', [!!muted, groupId, req.user!.id]);
    res.json({ muted: !!muted });
  } catch (error) { res.status(500).json({ message: 'Failed to update mute' }); }
});

router.put('/:id/mute-all', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  const { mute_all } = req.body;
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    if (!(await isAdmin(groupId, req.user!.id))) return res.status(403).json({ message: 'Only admins can toggle mute-all' });
    await pool.query('UPDATE group_conversations SET is_muted_all = $1 WHERE id = $2', [!!mute_all, groupId]);
    res.json({ mute_all: !!mute_all });
  } catch (error) { res.status(500).json({ message: 'Failed to toggle mute-all' }); }
});

router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    await pool.query('UPDATE group_members SET last_read_at = NOW() WHERE group_id = $1 AND user_id = $2', [groupId, req.user!.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ message: 'Failed to mark as read' }); }
});

// Typing
router.post('/:id/typing', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.json({ success: true });
  const key = `group-${groupId}`;
  if (!groupTypingState[key]) groupTypingState[key] = [];
  const existing = groupTypingState[key].find(t => t.userId === req.user!.id);
  if (existing) { existing.ts = Date.now(); } else {
    const u = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    groupTypingState[key].push({ userId: req.user!.id, username: u.rows[0]?.username || 'User', ts: Date.now() });
  }
  res.json({ success: true });
});

router.get('/:id/typing-status', async (req: AuthRequest, res: Response) => {
  const groupId = parseInt(String(req.params.id));
  if (isNaN(groupId)) return res.json({ typing: [] });
  const key = `group-${groupId}`;
  const now = Date.now();
  const active = (groupTypingState[key] || []).filter(t => now - t.ts < 4000 && t.userId !== req.user!.id);
  groupTypingState[key] = (groupTypingState[key] || []).filter(t => now - t.ts < 4000);
  res.json({ typing: active.map(t => ({ userId: t.userId, username: t.username })) });
});

export default router;
