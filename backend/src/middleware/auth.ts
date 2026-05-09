import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import config from '../config';
import { AuthRequest, UserRole } from '../types';
import { sendError } from '../utils/response';

/**
 * Check if user is a Super Admin (admin role without companyId)
 */
export const isSuperAdmin = (user: AuthRequest['user']): boolean => {
  return user?.role === UserRole.ADMIN && !user?.companyId;
};

/**
 * Get the tenant companyId for filtering — returns null for super admin (global access)
 */
export const getTenantCompanyId = (user: AuthRequest['user']): string | null => {
  if (isSuperAdmin(user)) return null; // super admin sees everything
  return user?.companyId || null;
};

/**
 * Middleware: Require authenticated user to have a companyId (blocks super admin)
 * Use on routes that MUST be tenant-scoped.
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
 * Protect routes - Verify JWT token
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    let token: string | undefined;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return sendError(res, 'Not authorized to access this route', 401);
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        email: string;
        role: UserRole;
      };

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      if (user.deletedAt) {
        return sendError(res, 'User account has been deleted', 403);
      }

      if (user.status !== 'active') {
        return sendError(res, 'User account is not active', 403);
      }

      // Attach user to request
      (req as AuthRequest).user = {
        ...user.toObject(),
        _id: (user._id as any).toString(),
        companyId: user.companyId?.toString(),
      } as any;

      next();
    } catch (error) {
      return sendError(res, 'Not authorized to access this route', 401);
    }
  } catch (error) {
    return sendError(res, 'Server error', 500);
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
        `User role ${user.role} is not authorized to access this route`,
        403
      );
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as {
          id: string;
        };
        const user = await User.findById(decoded.id).select('-password');
        if (user && !user.deletedAt && user.status === 'active') {
          (req as AuthRequest).user = {
            ...user.toObject(),
            _id: (user._id as any).toString(),
            companyId: user.companyId?.toString(),
          } as any;
        }
      } catch (error) {
        // Token invalid, but continue without user
      }
    }

    next();
  } catch (error) {
    next();
  }
};
