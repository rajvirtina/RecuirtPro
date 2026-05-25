/**
 * General rate limiter
 */
export declare const limiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Stricter rate limiter for auth endpoints
 */
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter for file uploads
 */
export declare const uploadLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter for AI interview answer submissions.
 * 50 answers per session per hour (a 12-question session has ~12 submissions;
 * this allows retries and retakes while blocking scripted abuse).
 */
export declare const aiAnswerLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map