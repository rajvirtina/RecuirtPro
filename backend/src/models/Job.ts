import mongoose, { Schema, Document } from 'mongoose';
import { JobStatus, JobType, WorkMode, IJobPosting } from '../types';

export interface IJobDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  skills: string[];
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  location: string;
  workMode: WorkMode;
  jobType: JobType;
  status: JobStatus;
  department?: string;
  positions: number;
  joiningDate?: Date;
  expiryDate?: Date;
  tags?: string[];
  version: number;
  previousVersionId?: mongoose.Types.ObjectId;
  postings: IJobPosting[];
  createdBy: mongoose.Types.ObjectId;
  publishedAt?: Date;
  closedAt?: Date;
  viewCount: number;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const jobPostingSchema = new Schema<IJobPosting>(
  {
    portal: {
      type: String,
      required: true,
    },
    postedAt: {
      type: Date,
    },
    externalId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'posted', 'failed'],
      default: 'pending',
    },
    error: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const jobSchema = new Schema<IJobDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters'], // BUG-005/VAL-002
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [20000, 'Job description cannot exceed 20,000 characters'], // BUG-005/VAL-002
    },
    responsibilities: {
      type: [String],
      validate: {
        validator: (arr: string[]) => arr.every((s) => s.trim().length > 0 && s.length <= 500),
        message: 'Each responsibility must be non-empty and ≤ 500 characters',
      },
    },
    requirements: {
      type: [String],
      validate: {
        validator: (arr: string[]) => arr.every((s) => s.trim().length > 0 && s.length <= 500),
        message: 'Each requirement must be non-empty and ≤ 500 characters',
      },
    },
    skills: {
      type: [String],
      required: true,
      validate: [
        // VAL-003: reject empty-string skills
        {
          validator: (arr: string[]) => arr.every((s) => s.trim().length > 0),
          message: 'Skills must not contain empty strings',
        },
        {
          validator: (arr: string[]) => arr.every((s) => s.length <= 100),
          message: 'Each skill name must be ≤ 100 characters',
        },
      ],
    },
    experienceMin: {
      type: Number,
      required: true,
      min: 0,
    },
    experienceMax: {
      type: Number,
      required: true,
      min: 0,
    },
    salaryMin: {
      type: Number,
      min: 0,
    },
    salaryMax: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    location: {
      type: String,
      required: true,
    },
    workMode: {
      type: String,
      enum: Object.values(WorkMode),
      required: true,
    },
    jobType: {
      type: String,
      enum: Object.values(JobType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.DRAFT,
    },
    department: {
      type: String,
    },
    positions: {
      type: Number,
      default: 1,
      min: 1,
    },
    joiningDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    tags: [String],
    version: {
      type: Number,
      default: 1,
    },
    previousVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    postings: [jobPostingSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    applicationCount: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ expiryDate: 1 });

// Auto-expire jobs
jobSchema.pre('save', function (next) {
  if (this.expiryDate && new Date() > this.expiryDate && this.status === JobStatus.PUBLISHED) {
    this.status = JobStatus.EXPIRED;
  }
  next();
});

export const Job = mongoose.model<IJobDocument>('Job', jobSchema);
