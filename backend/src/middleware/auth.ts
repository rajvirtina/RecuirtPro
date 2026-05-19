import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import config from '../config';
import { AuthRequest, UserRole } from '../types';
import { sendError } from '../utils/response';

/**
 * Check if user is a Super Admin.
 */
export const isSuperAdmin = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  if ((user as any).isSuperAdminUser === true) return true;
  return user.role === UserRole.ADMIN && !user.companyId;
};

/**
 * Get the tenant companyId — returns null for super admin (global access)
 */
export const getTenantCompanyId = (user: AuthRequest['user']): string | null => {
  if (isSuperAdmin(user)) return null;
  return user?.companyId || null;
};

/**
 * Require authenticated user to have a companyId (blocks super admin on tenant-only routes)
 */
export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const user = (req as AuthRequest).user;
  if (!user?.companyId) {
    return sendError(res, 'This action requires a company context', 403);
  }
  next();
};

/**
 * Extract token from request — BUG-001: prefer httpOnly cookie, fall back to Bearer header.
 */
function extractToken(req: Request): string | undefined {
  // 1. httpOnly cookie (most secure — not accessible by JS)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken as string;
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
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = extractToken(req);

    if (!token) {
      return sendError(res, 'Not authorized to access this route', 401);
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        email: string;
        role: UserRole;
      };

      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      // BUG-013: soft-deleted check
      if (user.deletedAt) {
        return sendError(res, 'User account has been deactivated. Please contact support.', 403);
      }

      if (user.status !== 'active') {
        return sendError(res, 'User account is not active. Please verify your email or contact support.', 403);
      }

      // BUG-011: enforce email verification when the feature flag is on
      // Super admins (seeded directly) are exempt from email verification
      const userIsSuperAdmin = user.role === UserRole.ADMIN && !user.companyId;
      if (config.features.emailVerification && !user.emailVerified && !userIsSuperAdmin) {
        return sendError(res, 'Please verify your email address before accessing this feature.', 403);
      }

      (req as AuthRequest).user = {
        ...user.toObject(),
        _id: (user._id as any).toString(),
        companyId: user.companyId?.toString(),
      } as any;

      next();
    } catch (jwtError) {
      return sendError(res, 'Token invalid or expired. Please log in again.', 401);
    }
  } catch (error) {
    return sendError(res, 'Server error during authentication', 500);
  }
};

/**
 * Authorize specific roles
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const user = (req as AuthRequest).user;

    if (!user) {
      return sendError(res, 'Not authorized', 401);
    }

    if (!roles.includes(user.role)) {
      return sendError(
        res,
        `Role '${user.role}' is not permitted to access this route`,
        403
      );
    }

    next();
  };
};

/**
 * Optional authentication — does not fail if no token present
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
        const user = await User.findById(decoded.id).select('-password');
        if (user && !user.deletedAt && user.status === 'active') {
          (req as AuthRequest).user = {
            ...user.toObject(),
            _id: (user._id as any).toString(),
            companyId: user.companyId?.toString(),
          } as any;
        }
      } catch {
        // Invalid token — continue without user
      }
    }

    next();
  } catch {
    next();
  }
};

/**
 * BUG-009: CSRF protection middleware.
 * Validates that state-changing requests from browser include X-CSRF-Token
 * matching the csrf-token cookie (double-submit cookie pattern).
 * Skipped for requests using Bearer token auth (API clients).
 */
export const csrfProtect = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
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

  const cookieCsrf = req.cookies?.csrfToken as string | undefined;
  const headerCsrf = req.headers['x-csrf-token'] as string | undefined;

  if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
    return sendError(res, 'Invalid CSRF token', 403);
  }

  next();
};
