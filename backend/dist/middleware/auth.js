"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtect = exports.optionalAuth = exports.authorize = exports.protect = exports.requireTenant = exports.getTenantCompanyId = exports.isSuperAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const config_1 = __importDefault(require("../config"));
const types_1 = require("../types");
const response_1 = require("../utils/response");
/**
 * Check if user is a Super Admin.
 */
const isSuperAdmin = (user) => {
    if (!user)
        return false;
    if (user.isSuperAdminUser === true)
        return true;
    return user.role === types_1.UserRole.ADMIN && !user.companyId;
};
exports.isSuperAdmin = isSuperAdmin;
/**
 * Get the tenant companyId — returns null for super admin (global access)
 */
const getTenantCompanyId = (user) => {
    if ((0, exports.isSuperAdmin)(user))
        return null;
    return user?.companyId || null;
};
exports.getTenantCompanyId = getTenantCompanyId;
/**
 * Require authenticated user to have a companyId (blocks super admin on tenant-only routes)
 */
const requireTenant = (req, res, next) => {
    const user = req.user;
    if (!user?.companyId) {
        return (0, response_1.sendError)(res, 'This action requires a company context', 403);
    }
    next();
};
exports.requireTenant = requireTenant;
/**
 * Extract token from request — BUG-001: prefer httpOnly cookie, fall back to Bearer header.
 */
function extractToken(req) {
    // 1. httpOnly cookie (most secure — not accessible by JS)
    if (req.cookies?.accessToken) {
        return req.cookies.accessToken;
    }
    // 2. Authorization header (for mobile clients / API consumers)
    if (req.headers.authorization?.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
    return undefined;
}
/**
 * Protect routes — verify JWT token (cookie-first, Bearer fallback)
 */
const protect = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return (0, response_1.sendError)(res, 'Not authorized to access this route', 401);
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
            const user = await models_1.User.findById(decoded.id).select('-password');
            if (!user) {
                return (0, response_1.sendError)(res, 'User not found', 404);
            }
            // BUG-013: soft-deleted check
            if (user.deletedAt) {
                return (0, response_1.sendError)(res, 'User account has been deactivated. Please contact support.', 403);
            }
            if (user.status !== 'active') {
                return (0, response_1.sendError)(res, 'User account is not active. Please verify your email or contact support.', 403);
            }
            // BUG-011: enforce email verification when the feature flag is on
            if (config_1.default.features.emailVerification && !user.emailVerified) {
                return (0, response_1.sendError)(res, 'Please verify your email address before accessing this feature.', 403);
            }
            req.user = {
                ...user.toObject(),
                _id: user._id.toString(),
                companyId: user.companyId?.toString(),
            };
            next();
        }
        catch (jwtError) {
            return (0, response_1.sendError)(res, 'Token invalid or expired. Please log in again.', 401);
        }
    }
    catch (error) {
        return (0, response_1.sendError)(res, 'Server error during authentication', 500);
    }
};
exports.protect = protect;
/**
 * Authorize specific roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return (0, response_1.sendError)(res, 'Not authorized', 401);
        }
        if (!roles.includes(user.role)) {
            return (0, response_1.sendError)(res, `Role '${user.role}' is not permitted to access this route`, 403);
        }
        next();
    };
};
exports.authorize = authorize;
/**
 * Optional authentication — does not fail if no token present
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
                const user = await models_1.User.findById(decoded.id).select('-password');
                if (user && !user.deletedAt && user.status === 'active') {
                    req.user = {
                        ...user.toObject(),
                        _id: user._id.toString(),
                        companyId: user.companyId?.toString(),
                    };
                }
            }
            catch {
                // Invalid token — continue without user
            }
        }
        next();
    }
    catch {
        next();
    }
};
exports.optionalAuth = optionalAuth;
/**
 * BUG-009: CSRF protection middleware.
 * Validates that state-changing requests from browser include X-CSRF-Token
 * matching the csrf-token cookie (double-submit cookie pattern).
 * Skipped for requests using Bearer token auth (API clients).
 */
const csrfProtect = (req, res, next) => {
    // Only apply CSRF check when request came via cookie auth, not Bearer
    const usesCookie = !!req.cookies?.accessToken;
    const usesBearerOnly = !!req.headers.authorization?.startsWith('Bearer ') && !usesCookie;
    if (usesBearerOnly) {
        return next(); // API consumers using Bearer are not CSRF targets
    }
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }
    const cookieCsrf = req.cookies?.csrfToken;
    const headerCsrf = req.headers['x-csrf-token'];
    if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
        return (0, response_1.sendError)(res, 'Invalid CSRF token', 403);
    }
    next();
};
exports.csrfProtect = csrfProtect;
//# sourceMappingURL=auth.js.map