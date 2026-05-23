import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 40 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-40 characters, alphanumeric and underscore only'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
  body('full_name').optional().isLength({ max: 80 }),
];

export const validatePost = [
  body('caption').optional().isLength({ max: 2200 }),
  // Accept EITHER image_base64 OR video_base64
  body('image_base64')
    .optional()
    .custom((value) => {
      // Block SVG and other XSS-capable formats BEFORE the format check
      const blockedPatterns = ['image/svg', 'image/xml', 'text/html', 'text/xml'];
      if (blockedPatterns.some(p => value.toLowerCase().includes(p))) {
        throw new Error('SVG and XML files are not allowed');
      }
      if (!value.startsWith('data:image/')) {
        throw new Error('Invalid image format');
      }
      const sizeInBytes = (value.split(',')[1].length * 3) / 4;
      if (sizeInBytes > 5 * 1024 * 1024) {
        throw new Error('Image must be under 5MB');
      }
      return true;
    }),
  body('video_base64')
    .optional()
    .custom((value) => {
      if (!value.startsWith('data:video/')) {
        throw new Error('Invalid video format');
      }
      const sizeInBytes = (value.split(',')[1]?.length || 0) * 3 / 4;
      if (sizeInBytes > 50 * 1024 * 1024) {
        throw new Error('Video must be under 50MB');
      }
      return true;
    }),
];

export const validateComment = [
  body('body')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be 1-1000 characters'),
];

export const validateMessage = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be 1-1000 characters'),
];

export const validateRichMessage = [
  body('message_type')
    .isIn(['gif', 'sticker'])
    .withMessage('message_type must be gif or sticker'),
  body('media_url')
    .notEmpty()
    .withMessage('media_url is required for GIF/sticker messages'),
];

export const validateVoiceMessage = [
  body('audio_base64')
    .notEmpty()
    .custom((value: string) => {
      if (!value.startsWith('data:audio/')) {
        throw new Error('Invalid audio format — must be a data:audio/* base64 string');
      }
      const sizeInBytes = (value.split(',')[1]?.length || 0) * 3 / 4;
      if (sizeInBytes > 5 * 1024 * 1024) {
        throw new Error('Voice message must be under 5MB');
      }
      return true;
    }),
];

export const validateReport = [
  body('reason')
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be 1-200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be under 1000 characters'),
];

export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}