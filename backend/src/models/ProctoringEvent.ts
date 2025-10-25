import mongoose, { Schema, Document } from 'mongoose';
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

const proctoringEventSchema = new Schema<IProctoringEventDocument>(
  {
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventType: {
      type: String,
      enum: Object.values(ProctoringEventType),
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    description: String,
    snapshotUrl: String,
    metadata: {
      type: Schema.Types.Mixed,
    },
    reviewed: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewComments: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
proctoringEventSchema.index({ interviewId: 1, timestamp: -1 });
proctoringEventSchema.index({ candidateId: 1 });
proctoringEventSchema.index({ eventType: 1, severity: 1 });
proctoringEventSchema.index({ reviewed: 1 });

// TTL index for automatic deletion after 90 days (data retention policy)
proctoringEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

export const ProctoringEvent = mongoose.model<IProctoringEventDocument>(
  'ProctoringEvent',
  proctoringEventSchema
);
