"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAnswerLimiter = exports.uploadLimiter = exports.authLimiter = exports.limiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importDefault(require("../config"));
/**
 * General rate limiter
 */
exports.limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.rateLimit.windowMs,
    max: config_1.default.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * Stricter rate limiter for auth endpoints
 */
exports.authLimiter = (0, express_rate_limit_1.default)({
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
exports.uploadLimiter = (0, express_rate_limit_1.default)({
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
exports.aiAnswerLimiter = (0, express_rate_limit_1.default)({
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
//# sourceMappingURL=rateLimiter.js.map