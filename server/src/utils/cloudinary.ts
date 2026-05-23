import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Validate Cloudinary credentials at startup (fail early, not on first upload)
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cloudinary credentials required in production');
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(base64Image: string): Promise<string> {
  try {
    const isVideo = base64Image.startsWith('data:video/');
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'socialconnect',
      resource_type: 'auto',
      timeout: 30000,
      // Block SVG and other dangerous formats — only allow safe image/video types
      ...(isVideo
        ? { allowed_formats: ['mp4', 'webm', 'mov', 'avi'] }
        : {
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'],
            transformation: [
              { quality: 'auto', fetch_format: 'auto', width: 1920, crop: 'limit' as const }
            ],
          }
      ),
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed');
  }
}

/**
 * Delete a file from Cloudinary by its URL.
 * Extracts the public_id from the URL and calls destroy().
 * Works for images, videos, and audio (voice messages).
 * Falls back to queueing for retry on failure.
 */
export async function deleteFromCloudinary(url: string): Promise<void> {
  try {
    const publicId = extractPublicId(url);
    if (!publicId) return;

    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const resourceType = pathParts.includes('video') ? 'video' as const : 'image' as const;

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    // Queue for retry instead of silently dropping
    console.error('Cloudinary delete failed, queueing for retry:', error);
    try {
      const pool = (await import('../config/db')).default;
      await pool.query(
        'INSERT INTO cloudinary_cleanup_queue (public_id, resource_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [extractPublicId(url) || url, 'image']
      );
    } catch { /* non-fatal — best effort queue */ }
  }
}

/**
 * Extract Cloudinary public_id from a URL
 */
export function extractPublicId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const uploadIdx = pathParts.indexOf('upload');
    if (uploadIdx === -1) return null;

    const afterUpload = pathParts.slice(uploadIdx + 1);
    const versionSkipped = afterUpload[0]?.startsWith('v') ? afterUpload.slice(1) : afterUpload;
    const publicIdWithExt = versionSkipped.join('/');
    return publicIdWithExt.replace(/\.[^/.]+$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * Process the Cloudinary cleanup queue — called by the hourly cleanup job in server.ts
 * Retries failed Cloudinary deletions up to 3 times.
 */
export async function processCloudinaryQueue(): Promise<number> {
  const pool = (await import('../config/db')).default;
  let processed = 0;

  try {
    const pending = await pool.query(
      `SELECT * FROM cloudinary_cleanup_queue 
       WHERE status = 'pending' AND attempts < 3
       ORDER BY created_at ASC LIMIT 20`
    );

    for (const item of pending.rows) {
      try {
        await cloudinary.uploader.destroy(item.public_id, { resource_type: item.resource_type || 'image' });
        await pool.query("UPDATE cloudinary_cleanup_queue SET status = 'done' WHERE id = $1", [item.id]);
        processed++;
      } catch {
        await pool.query(
          `UPDATE cloudinary_cleanup_queue 
           SET attempts = attempts + 1, last_attempt = NOW(),
               status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END
           WHERE id = $1`,
          [item.id]
        );
      }
    }
  } catch { /* non-fatal */ }

  return processed;
}

export default cloudinary;