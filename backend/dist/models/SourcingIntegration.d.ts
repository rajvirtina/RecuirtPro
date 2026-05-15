import mongoose, { Document } from 'mongoose';
import { SourcingPlatform, IntegrationStatus } from '../types';
export interface ISourcingIntegrationDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    platform: SourcingPlatform;
    status: IntegrationStatus;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    scopes?: string[];
    externalUserId?: string;
    externalUsername?: string;
    metadata?: Record<string, any>;
    lastSyncAt?: Date;
    errorMessage?: string;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    getDecryptedAccessToken(): string;
    getDecryptedRefreshToken(): string | null;
}
export declare const SourcingIntegration: mongoose.Model<ISourcingIntegrationDocument, {}, {}, {}, mongoose.Document<unknown, {}, ISourcingIntegrationDocument, {}, {}> & ISourcingIntegrationDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SourcingIntegration.d.ts.map