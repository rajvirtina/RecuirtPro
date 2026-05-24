import rateLimit from 'express-rate-limit';
import config from '../config';

/**
 * General rate limiter
 */
export const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for auth endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for AI interview answer submissions.
 * 50 answers per session per hour (a 12-question session has ~12 submissions;
 * this allows retries and retakes while blocking scripted abuse).
 */
export const aiAnswerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyGenerator: (req) => {
    // Key = sessionId + IP so multiple candidates on the same NAT can each submit
    const sessionId = req.params?.sessionId || 'unknown';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `ai-answer:${sessionId}:${ip}`;
  },
  message: { success: false, message: 'Too many answer submissions. Please wait before continuing.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});
