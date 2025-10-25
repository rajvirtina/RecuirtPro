import mongoose, { Schema, Document } from 'mongoose';
import { AuditAction } from '../types';

export interface IAuditLogDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  userName?: string;
  companyId?: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: any;
  timestamp: Date;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userEmail: String,
    userName: String,
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: String,
    description: {
      type: String,
      required: true,
    },
    ipAddress: String,
    userAgent: String,
    changes: {
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed,
    },
    metadata: Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });

// TTL index for automatic deletion based on retention policy (also serves as timestamp index)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
