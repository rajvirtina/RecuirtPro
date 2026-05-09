import mongoose, { Schema, Document } from 'mongoose';
import { CalendarProvider, ICalendarIntegration } from '../types';
import { encrypt, decrypt } from '../utils/encryption';

export interface ICalendarIntegrationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
  calendarId?: string;
  email: string;
  isActive: boolean;
  lastSyncedAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const calendarIntegrationSchema = new Schema<ICalendarIntegrationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(CalendarProvider),
      required: true,
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
    tokenType: {
      type: String,
      default: 'Bearer',
    },
    expiresAt: Date,
    scope: String,
    calendarId: String,
    email: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSyncedAt: Date,
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Indexes
calendarIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
calendarIntegrationSchema.index({ isActive: 1 });

// SEC-11: Encrypt OAuth tokens before saving to DB
calendarIntegrationSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && this.accessToken && !this.accessToken.includes(':')) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.includes(':')) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  next();
});

// SEC-11: Decrypt tokens when reading from DB
calendarIntegrationSchema.methods.getDecryptedAccessToken = function (): string {
  try {
    return decrypt(this.accessToken);
  } catch {
    return this.accessToken; // Return raw if decryption fails (legacy data)
  }
};

calendarIntegrationSchema.methods.getDecryptedRefreshToken = function (): string | undefined {
  if (!this.refreshToken) return undefined;
  try {
    return decrypt(this.refreshToken);
  } catch {
    return this.refreshToken;
  }
};

export const CalendarIntegration = mongoose.model<ICalendarIntegrationDocument>(
  'CalendarIntegration',
  calendarIntegrationSchema
);
