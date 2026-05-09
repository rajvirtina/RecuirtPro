import mongoose, { Schema, Document } from 'mongoose';
import { SourcingPlatform } from '../types';

export interface ISourcingSearchDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId;
  platforms: SourcingPlatform[];
  criteria: {
    keywords?: string[];
    skills?: string[];
    location?: string;
    experienceMin?: number;
    experienceMax?: number;
    noticePeriod?: string;
    employmentType?: string;
    education?: string[];
    techStack?: string[];
    minMatchScore?: number;
  };
  resultsCount: number;
  shortlistedCount: number;
  avgMatchScore?: number;
  executionTimeMs?: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sourcingSearchSchema = new Schema<ISourcingSearchDocument>(
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
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    platforms: [{
      type: String,
      enum: Object.values(SourcingPlatform),
    }],
    criteria: {
      keywords: [String],
      skills: [String],
      location: String,
      experienceMin: Number,
      experienceMax: Number,
      noticePeriod: String,
      employmentType: String,
      education: [String],
      techStack: [String],
      minMatchScore: { type: Number, default: 85 },
    },
    resultsCount: { type: Number, default: 0 },
    shortlistedCount: { type: Number, default: 0 },
    avgMatchScore: Number,
    executionTimeMs: Number,
    deletedAt: Date,
  },
  { timestamps: true }
);

sourcingSearchSchema.index({ companyId: 1, createdAt: -1 });
sourcingSearchSchema.index({ userId: 1, createdAt: -1 });

export const SourcingSearch = mongoose.model<ISourcingSearchDocument>(
  'SourcingSearch',
  sourcingSearchSchema
);
