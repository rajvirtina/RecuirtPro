import mongoose, { Schema, Document, Model } from 'mongoose';

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
  consentVersion: string; // Version of privacy policy/terms accepted
  granted: boolean; // true = accepted, false = declined
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    os?: string;
  };
  interviewId?: mongoose.Types.ObjectId; // If consent is for specific interview
  companyId?: mongoose.Types.ObjectId; // Company requesting consent
  metadata?: {
    policyUrl?: string;
    withdrawnAt?: Date;
    withdrawnReason?: string;
    replacedBy?: mongoose.Types.ObjectId; // If consent was updated
    [key: string]: any;
  };
}

// Interface for static methods
interface IConsentLogModel extends Model<IConsentLog> {
  getLatestConsent(
    userId: mongoose.Types.ObjectId,
    consentType: ConsentType
  ): Promise<IConsentLog | null>;
  
  hasValidConsent(
    userId: mongoose.Types.ObjectId,
    consentType: ConsentType,
    minVersion?: string
  ): Promise<boolean>;
  
  recordConsent(data: Partial<IConsentLog>): Promise<IConsentLog>;
  
  withdrawConsent(
    userId: mongoose.Types.ObjectId,
    consentType: ConsentType,
    reason?: string
  ): Promise<IConsentLog>;
}

const ConsentLogSchema = new Schema<IConsentLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    consentType: {
      type: String,
      enum: ['monitoring', 'recording', 'data_processing', 'marketing', 'terms_of_service'],
      required: true,
      index: true,
    },
    consentVersion: {
      type: String,
      required: true,
      default: '1.0',
    },
    granted: {
      type: Boolean,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    deviceInfo: {
      platform: String,
      browser: String,
      os: String,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'consentlogs',
  }
);

// Indexes for efficient querying
ConsentLogSchema.index({ userId: 1, consentType: 1, timestamp: -1 });
ConsentLogSchema.index({ interviewId: 1, userId: 1 });
ConsentLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 }); // 7 years retention (GDPR requirement)

// Helper method to get latest consent for user + type
ConsentLogSchema.statics.getLatestConsent = async function (
  userId: mongoose.Types.ObjectId,
  consentType: ConsentType
): Promise<IConsentLog | null> {
  return this.findOne({ userId, consentType })
    .sort({ timestamp: -1 })
    .exec();
};

// Helper method to check if user has valid consent
ConsentLogSchema.statics.hasValidConsent = async function (
  userId: mongoose.Types.ObjectId,
  consentType: ConsentType,
  minVersion?: string
): Promise<boolean> {
  const consent = await (this as IConsentLogModel).getLatestConsent(userId, consentType);
  
  if (!consent || !consent.granted) {
    return false;
  }

  // Check if consent was withdrawn
  if (consent.metadata?.withdrawnAt) {
    return false;
  }

  // Check version if specified
  if (minVersion && consent.consentVersion < minVersion) {
    return false;
  }

  return true;
};

// Helper method to record consent
ConsentLogSchema.statics.recordConsent = async function (
  data: Partial<IConsentLog>
): Promise<IConsentLog> {
  const consent = new this(data);
  await consent.save();
  return consent;
};

// Helper method to withdraw consent
ConsentLogSchema.statics.withdrawConsent = async function (
  userId: mongoose.Types.ObjectId,
  consentType: ConsentType,
  reason?: string
): Promise<IConsentLog> {
  const withdrawalData: Partial<IConsentLog> = {
    userId,
    consentType: consentType as ConsentType,
    granted: false,
    timestamp: new Date(),
    metadata: {
      withdrawnAt: new Date(),
      withdrawnReason: reason,
    },
  };

  const consent = await (this as IConsentLogModel).recordConsent(withdrawalData);
  return consent;
};

const ConsentLog = mongoose.model<IConsentLog, IConsentLogModel>('ConsentLog', ConsentLogSchema);

export default ConsentLog;
