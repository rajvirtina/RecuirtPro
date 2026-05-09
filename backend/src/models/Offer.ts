import mongoose, { Schema, Document } from 'mongoose';
import { OfferStatus } from '../types';

export interface IOfferDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  status: OfferStatus;
  // Compensation
  salary: {
    amount: number;
    currency: string;
    frequency: 'annual' | 'monthly';
  };
  bonus?: {
    amount: number;
    type: 'signing' | 'performance' | 'retention';
    details?: string;
  };
  equity?: {
    type: 'stock_options' | 'rsus' | 'esops';
    units?: number;
    vestingPeriod?: string;
    details?: string;
  };
  // Role details
  designation: string;
  department?: string;
  reportingTo?: string;
  joiningDate: Date;
  location?: string;
  workMode?: 'onsite' | 'remote' | 'hybrid';
  // Terms
  probationPeriod?: number; // months
  noticePeriod?: number; // days
  benefits?: string[];
  additionalTerms?: string;
  // Letter
  offerLetterUrl?: string;
  offerLetterHtml?: string;
  // Approval
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  approvalComments?: string;
  // Candidate response
  sentAt?: Date;
  expiresAt?: Date;
  respondedAt?: Date;
  candidateComments?: string;
  // Negotiation
  negotiations?: Array<{
    round: number;
    proposedBy: 'company' | 'candidate';
    changes: Record<string, any>;
    comments?: string;
    createdAt: Date;
  }>;
  // Tracking
  statusHistory: Array<{
    status: OfferStatus;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    remarks?: string;
  }>;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOfferDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OfferStatus),
      default: OfferStatus.DRAFT,
    },
    salary: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      frequency: { type: String, enum: ['annual', 'monthly'], default: 'annual' },
    },
    bonus: {
      amount: Number,
      type: { type: String, enum: ['signing', 'performance', 'retention'] },
      details: String,
    },
    equity: {
      type: {
        type: String,
        enum: ['stock_options', 'rsus', 'esops'],
      },
      units: Number,
      vestingPeriod: String,
      details: String,
    },
    designation: { type: String, required: true },
    department: String,
    reportingTo: String,
    joiningDate: { type: Date, required: true },
    location: String,
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'] },
    probationPeriod: Number,
    noticePeriod: Number,
    benefits: [String],
    additionalTerms: String,
    offerLetterUrl: String,
    offerLetterHtml: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    approvalComments: String,
    sentAt: Date,
    expiresAt: Date,
    respondedAt: Date,
    candidateComments: String,
    negotiations: [
      {
        round: Number,
        proposedBy: { type: String, enum: ['company', 'candidate'] },
        changes: Schema.Types.Mixed,
        comments: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        status: { type: String, enum: Object.values(OfferStatus) },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        remarks: String,
      },
    ],
    deletedAt: Date,
  },
  { timestamps: true }
);

// Indexes — tenant isolation
offerSchema.index({ companyId: 1, status: 1 });
offerSchema.index({ applicationId: 1 }, { unique: true });
offerSchema.index({ candidateId: 1, companyId: 1 });
offerSchema.index({ companyId: 1, deletedAt: 1 });

export const Offer = mongoose.model<IOfferDocument>('Offer', offerSchema);
