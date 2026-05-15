import { Request, Response, NextFunction } from 'express';
import { AuditAction } from '../types';
/**
 * Create audit log entry
 */
export declare const createAuditLog: (userId: string | undefined, action: AuditAction, resource: string, resourceId: string | undefined, description: string, req: Request, changes?: {
    before?: any;
    after?: any;
}) => Promise<void>;
/**
 * Audit middleware
 */
export declare const audit: (action: AuditAction, resource: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=audit.d.ts.map