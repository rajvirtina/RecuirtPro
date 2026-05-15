import mongoose, { Document } from 'mongoose';
import { ProctoringEventType } from '../types';
export interface IProctoringEventDocument extends Document {
    interviewId: mongoose.Types.ObjectId;
    candidateId: mongoose.Types.ObjectId;
    eventType: ProctoringEventType;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    snapshotUrl?: string;
    metadata?: {
        browserInfo?: string;
        deviceInfo?: string;
        ipAddress?: string;
        location?: string;
        tabTitle?: string;
        applicationName?: string;
        faceCount?: number;
        gazeDirection?: string;
        [key: string]: any;
    };
    reviewed: boolean;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewComments?: string;
    createdAt: Date;
}
export declare const ProctoringEvent: mongoose.Model<IProctoringEventDocument, {}, {}, {}, mongoose.Document<unknown, {}, IProctoringEventDocument, {}, {}> & IProctoringEventDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ProctoringEvent.d.ts.map