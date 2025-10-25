import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';
import { AuthRequest, AuditAction } from '../types';
import logger from '../utils/logger';

/**
 * Create audit log entry
 */
export const createAuditLog = async (
  userId: string | undefined,
  action: AuditAction,
  resource: string,
  resourceId: string | undefined,
  description: string,
  req: Request,
  changes?: { before?: any; after?: any }
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    
    await AuditLog.create({
      userId,
      userEmail: user?.email,
      userName: user ? `${user.firstName} ${user.lastName}` : undefined,
      companyId: user?.companyId,
      action,
      resource,
      resourceId,
      description,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      changes,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(`Failed to create audit log: ${error}`);
  }
};

/**
 * Audit middleware
 */
export const audit = (action: AuditAction, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as AuthRequest).user;
    const resourceId = req.params.id;

    try {
      await createAuditLog(
        user?._id,
        action,
        resource,
        resourceId,
        `${action} ${resource}${resourceId ? ` ${resourceId}` : ''}`,
        req
      );
    } catch (error) {
      logger.error(`Audit middleware error: ${error}`);
    }

    next();
  };
};
