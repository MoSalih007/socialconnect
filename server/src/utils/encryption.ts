import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Support both AES-256-GCM (new, authenticated) and AES-256-CBC (legacy, backwards-compatible)
const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';

if (!process.env.AES_KEY) {
  throw new Error('AES_KEY environment variable is required');
}
const MASTER_KEY = Buffer.from(process.env.AES_KEY, 'hex');
if (MASTER_KEY.length !== 32) {
  throw new Error('AES_KEY must be exactly 32 bytes (64 hex characters)');
}

/**
 * Derive a per-conversation encryption key using HKDF.
 * This ensures each conversation uses a unique key derived from the master key.
 * Even if one derived key is compromised, other conversations remain secure.
 *
 * @param context - A unique string for the conversation (e.g., "dm:3-7" or "group:42")
 * @returns A 32-byte derived key
 */
function deriveKey(context: string): Buffer {
  // Use HKDF: extract-then-expand
  // Salt is fixed but unique to our app (prevents rainbow table attacks)
  const salt = Buffer.from('socialconnect-msg-v1', 'utf8');
  const info = Buffer.from(context, 'utf8');

  // HKDF-Extract: PRK = HMAC-SHA256(salt, master_key)
  const prk = crypto.createHmac('sha256', salt).update(MASTER_KEY).digest();

  // HKDF-Expand: OKM = HMAC-SHA256(PRK, info || 0x01) truncated to 32 bytes
  const okm = crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest();

  return okm; // 32 bytes = 256 bits, perfect for AES-256
}

/**
 * Build a conversation context string for key derivation.
 * For DMs: sorted user IDs ensure both parties derive the same key.
 * For groups: group ID provides a unique context.
 */
export function dmContext(userA: number, userB: number): string {
  const sorted = [userA, userB].sort((a, b) => a - b);
  return `dm:${sorted[0]}-${sorted[1]}`;
}

export function groupContext(groupId: number, createdAt?: string): string {
  // Include createdAt to prevent key collision if group IDs are recycled
  // Falls back to groupId-only for backwards compatibility with existing messages
  return createdAt ? `group:${groupId}:${createdAt}` : `group:${groupId}`;
}

/**
 * Encrypt using AES-256-GCM (authenticated encryption).
 * GCM provides both confidentiality AND integrity — tampered ciphertext
 * will be detected and rejected during decryption.
 *
 * Format: "gcm:" + iv(24hex) + ":" + authTag(32hex) + ":" + ciphertext(hex)
 * The "gcm:" prefix distinguishes new messages from legacy CBC-encrypted ones.
 */
export function encrypt(text: string, context?: string): string {
  const key = context ? deriveKey(context) : MASTER_KEY;
  const iv = crypto.randomBytes(12); // GCM uses 12-byte IV (not 16)
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Prefix with "gcm:" so decrypt knows which algorithm to use
  return `gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt — detects format automatically.
 * - "gcm:" prefix → AES-256-GCM (new, authenticated)
 * - No prefix     → AES-256-CBC (legacy, backwards-compatible)
 *
 * This allows seamless migration: old messages still decrypt with CBC,
 * new messages use GCM. No data migration needed.
 */
export function decrypt(text: string, context?: string): string {
  try {
    if (!text || text.length < 5) return '[encrypted]';

    // Detect encryption version by prefix
    if (text.startsWith('gcm:')) {
      return decryptGCM(text, context);
    } else {
      return decryptCBC(text, context);
    }
  } catch (error) {
    console.error('Decryption failed (data may be corrupted):', error);
    return '[encrypted]';
  }
}

/**
 * AES-256-GCM decryption (new format).
 * If the auth tag doesn't match, decryption throws — this prevents tampered data.
 */
function decryptGCM(text: string, context?: string): string {
  // Format: "gcm:" + iv + ":" + authTag + ":" + ciphertext
  const parts = text.split(':');
  if (parts.length < 4) return '[encrypted]';

  const ivHex = parts[1];
  const authTagHex = parts[2];
  const encryptedHex = parts.slice(3).join(':');

  const key = context ? deriveKey(context) : MASTER_KEY;

  try {
    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8'); // Throws if auth tag mismatch
    return decrypted;
  } catch {
    // If context-derived key fails, try master key (backwards compat)
    if (context) {
      try {
        const decipher = crypto.createDecipheriv(GCM_ALGORITHM, MASTER_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch {
        return '[encrypted]';
      }
    }
    return '[encrypted]';
  }
}

/**
 * AES-256-CBC decryption (legacy format — for messages encrypted before GCM upgrade).
 * CBC does NOT provide authentication, but we keep support for reading old messages.
 */
function decryptCBC(text: string, context?: string): string {
  const parts = text.split(':');
  if (parts.length < 2) return '[encrypted]';
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts.slice(1).join(':');

  // Try with derived key first (if context provided)
  if (context) {
    try {
      const key = deriveKey(context);
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Fall through to master key
    }
  }

  // Fallback: decrypt with master key
  const decipher = crypto.createDecipheriv(CBC_ALGORITHM, MASTER_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}