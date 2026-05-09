import mongoose, { Schema, Document } from 'mongoose';
import { SourcingPlatform, IntegrationStatus } from '../types';
import { encrypt, decrypt } from '../utils/encryption';

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

const sourcingIntegrationSchema = new Schema<ISourcingIntegrationDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    platform: {
      type: String,
      enum: Object.values(SourcingPlatform),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(IntegrationStatus),
      default: IntegrationStatus.DISCONNECTED,
    },
    accessToken: {
      type: String,
      required: true,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    tokenExpiresAt: Date,
    scopes: [String],
    externalUserId: String,
    externalUsername: String,
    metadata: Schema.Types.Mixed,
    lastSyncAt: Date,
    errorMessage: String,
    deletedAt: Date,
  },
  { timestamps: true }
);

// Encrypt tokens before save
sourcingIntegrationSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && this.accessToken && !this.accessToken.includes(':')) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.includes(':')) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  next();
});

sourcingIntegrationSchema.methods.getDecryptedAccessToken = function (): string {
  try {
    return decrypt(this.accessToken);
  } catch {
    return this.accessToken;
  }
};

sourcingIntegrationSchema.methods.getDecryptedRefreshToken = function (): string | null {
  if (!this.refreshToken) return null;
  try {
    return decrypt(this.refreshToken);
  } catch {
    return this.refreshToken;
  }
};

// Indexes — tenant isolation
sourcingIntegrationSchema.index({ companyId: 1, platform: 1 });
sourcingIntegrationSchema.index({ userId: 1, platform: 1 }, { unique: true });
sourcingIntegrationSchema.index({ companyId: 1, deletedAt: 1 });

export const SourcingIntegration = mongoose.model<ISourcingIntegrationDocument>(
  'SourcingIntegration',
  sourcingIntegrationSchema
);
