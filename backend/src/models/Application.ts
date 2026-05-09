import mongoose, { Schema, Document } from 'mongoose';
import { ApplicationStatus } from '../types';

interface IStatusHistory {
  status: ApplicationStatus;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  remarks?: string;
}

export interface IApplicationDocument extends Document {
  jobId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  resumeUrl?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  statusHistory: IStatusHistory[];
  skillMatchScore?: number;
  experienceMatchScore?: number;
  overallScore?: number;
  appliedAt: Date;
  shortlistedAt?: Date;
  rejectedAt?: Date;
  hiredAt?: Date;
  rejectionReason?: string;
  notes?: Array<{
    addedBy: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
  }>;
  source: 'direct' | 'naukri' | 'linkedin' | 'referral';
  referralBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const statusHistorySchema = new Schema<IStatusHistory>(
  {
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: String,
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplicationDocument>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    resumeUrl: String,
    coverLetter: String,
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.APPLIED,
    },
    statusHistory: [statusHistorySchema],
    skillMatchScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    experienceMatchScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    shortlistedAt: Date,
    rejectedAt: Date,
    hiredAt: Date,
    rejectionReason: String,
    notes: [
      {
        addedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        note: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    source: {
      type: String,
      enum: ['direct', 'naukri', 'linkedin', 'referral'],
      default: 'direct',
    },
    referralBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
applicationSchema.index({ candidateId: 1, status: 1 });
applicationSchema.index({ companyId: 1, status: 1 });
applicationSchema.index({ overallScore: -1 });
applicationSchema.index({ appliedAt: -1 });

// Update timestamp fields on status change (B-07/B-08 fix: removed duplicate
// statusHistory push — history is now managed only in the controller, which
// correctly records the actual user who made the change).
applicationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    // Update timestamp fields
    switch (this.status) {
      case ApplicationStatus.SHORTLISTED:
        this.shortlistedAt = new Date();
        break;
      case ApplicationStatus.REJECTED:
        this.rejectedAt = new Date();
        break;
      case ApplicationStatus.HIRED:
        this.hiredAt = new Date();
        break;
    }
  }
  next();
});

export const Application = mongoose.model<IApplicationDocument>(
  'Application',
  applicationSchema
);
