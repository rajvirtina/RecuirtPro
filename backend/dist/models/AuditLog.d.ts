import mongoose, { Document } from 'mongoose';
import { AuditAction } from '../types';
export interface IAuditLogDocument extends Document {
    userId?: mongoose.Types.ObjectId;
    userEmail?: string;
    userName?: string;
    companyId?: mongoose.Types.ObjectId;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    changes?: {
        before?: any;
        after?: any;
    };
    metadata?: any;
    timestamp: Date;
    createdAt: Date;
}
export declare const AuditLog: mongoose.Model<IAuditLogDocument, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLogDocument, {}, {}> & IAuditLogDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AuditLog.d.ts.map