import mongoose, { Schema, Document } from 'mongoose';
import { CalendarProvider, ICalendarIntegration } from '../types';

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

export const CalendarIntegration = mongoose.model<ICalendarIntegrationDocument>(
  'CalendarIntegration',
  calendarIntegrationSchema
);
