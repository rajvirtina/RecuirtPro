/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
import mongoose, { Document } from 'mongoose';
export interface IRateLimitLog extends Document {
    identifier: string;
    action: string;
    attempts: number;
    lastAttempt: Date;
    blockedUntil?: Date;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RateLimitLog: mongoose.Model<IRateLimitLog, {}, {}, {}, mongoose.Document<unknown, {}, IRateLimitLog, {}, {}> & IRateLimitLog & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=RateLimitLog.d.ts.map