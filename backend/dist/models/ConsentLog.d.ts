import mongoose, { Document, Model } from 'mongoose';
/**
 * Consent Log Model
 * Tracks user consent for data processing, monitoring, and recording
 * Required for GDPR compliance (Article 7 - Conditions for consent)
 */
export type ConsentType = 'monitoring' | 'recording' | 'data_processing' | 'marketing' | 'terms_of_service';
export interface IConsentLog extends Document {
    userId: mongoose.Types.ObjectId;
    userEmail: string;
    userName: string;
    consentType: ConsentType;
    consentVersion: string;
    granted: boolean;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: {
        platform?: string;
        browser?: string;
        os?: string;
    };
    interviewId?: mongoose.Types.ObjectId;
    companyId?: mongoose.Types.ObjectId;
    metadata?: {
        policyUrl?: string;
        withdrawnAt?: Date;
        withdrawnReason?: string;
        replacedBy?: mongoose.Types.ObjectId;
        [key: string]: any;
    };
}
interface IConsentLogModel extends Model<IConsentLog> {
    getLatestConsent(userId: mongoose.Types.ObjectId, consentType: ConsentType): Promise<IConsentLog | null>;
    hasValidConsent(userId: mongoose.Types.ObjectId, consentType: ConsentType, minVersion?: string): Promise<boolean>;
    recordConsent(data: Partial<IConsentLog>): Promise<IConsentLog>;
    withdrawConsent(userId: mongoose.Types.ObjectId, consentType: ConsentType, reason?: string): Promise<IConsentLog>;
}
declare const ConsentLog: IConsentLogModel;
export default ConsentLog;
//# sourceMappingURL=ConsentLog.d.ts.map