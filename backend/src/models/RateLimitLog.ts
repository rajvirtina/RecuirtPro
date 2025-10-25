/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IRateLimitLog extends Document {
  identifier: string; // Email or IP address
  action: string; // 'password_reset', 'login', 'registration'
  attempts: number;
  lastAttempt: Date;
  blockedUntil?: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const rateLimitLogSchema = new Schema<IRateLimitLog>(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['password_reset', 'login', 'registration', '2fa_verification', 'email_verification'],
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
    blockedUntil: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
rateLimitLogSchema.index({ identifier: 1, action: 1 });
rateLimitLogSchema.index({ blockedUntil: 1 }, { expireAfterSeconds: 0 });

// TTL index to automatically delete old records after 24 hours
rateLimitLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const RateLimitLog = mongoose.model<IRateLimitLog>('RateLimitLog', rateLimitLogSchema);
