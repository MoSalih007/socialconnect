import rateLimit from 'express-rate-limit';

// Global rate limiter: 1000 requests per 15 minutes (polling app needs higher limit)
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter: 5 attempts per 15 minutes
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

// Password reset: 3 attempts per 15 minutes
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many password reset attempts, please try again later',
});

// Post creation: 5 posts per minute
export const postRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many posts, slow down!',
});

// Message sending: 20 messages per minute
export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many messages, slow down!',
});

// Group creation: 3 groups per hour
export const groupCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many groups created, try again later',
});

// Account deletion: 3 attempts per 15 minutes (prevents brute-force password guessing)
export const accountDeletionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many deletion attempts, please try again later',
});

// Search rate limiter — 30 searches per minute per IP
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many searches, please slow down',
});

// Report rate limiter — 10 reports per hour per IP
export const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many reports submitted. Please wait before reporting again.',
});

// Heartbeat rate limiter — 6 per minute (one every ~10 seconds is typical)
export const heartbeatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Too many heartbeat requests',
  standardHeaders: false,
  legacyHeaders: false,
});

// Resend verification email — 3 per 15 minutes
export const resendVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many verification email requests. Please wait and try again.',
});