import { Request, Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
/**
 * Check if user is a Super Admin.
 */
export declare const isSuperAdmin: (user: AuthRequest["user"]) => boolean;
/**
 * Get the tenant companyId — returns null for super admin (global access)
 */
export declare const getTenantCompanyId: (user: AuthRequest["user"]) => string | null;
/**
 * Require authenticated user to have a companyId (blocks super admin on tenant-only routes)
 */
export declare const requireTenant: (req: Request, res: Response, next: NextFunction) => void | Response;
/**
 * Protect routes — verify JWT token (cookie-first, Bearer fallback)
 */
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;
/**
 * Authorize specific roles
 */
export declare const authorize: (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void | Response;
/**
 * Optional authentication — does not fail if no token present
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * BUG-009: CSRF protection middleware.
 * Validates that state-changing requests from browser include X-CSRF-Token
 * matching the csrf-token cookie (double-submit cookie pattern).
 * Skipped for requests using Bearer token auth (API clients).
 */
export declare const csrfProtect: (req: Request, res: Response, next: NextFunction) => void | Response;
//# sourceMappingURL=auth.d.ts.map