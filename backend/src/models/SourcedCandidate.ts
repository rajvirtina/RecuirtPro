import mongoose, { Schema, Document } from 'mongoose';
import { SourcingPlatform } from '../types';

export interface ISourcedCandidateDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  sourcedBy: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId;
  platform: SourcingPlatform;
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  currentCompany?: string;
  currentPosition?: string;
  experience?: number;
  skills: string[];
  education?: string[];
  summary?: string;
  profileUrl?: string;
  resumeUrl?: string;
  imageUrl?: string;
  lastActive?: Date;
  // AI matching fields
  matchScore: number;
  matchDetails?: {
    skillScore: number;
    experienceScore: number;
    locationScore: number;
    semanticScore: number;
    recencyScore: number;
    overallScore: number;
    strengths: string[];
    missingSkills: string[];
    recommendation: string;
    confidenceScore: number;
  };
  // GitHub-specific
  githubData?: {
    username: string;
    publicRepos: number;
    followers: number;
    contributions: number;
    topLanguages: string[];
    topRepos: Array<{
      name: string;
      description?: string;
      stars: number;
      language?: string;
      url: string;
    }>;
    techStackScore: number;
  };
  // Pipeline
  status: 'sourced' | 'shortlisted' | 'contacted' | 'responded' | 'in_pipeline' | 'rejected' | 'saved';
  contactedAt?: Date;
  respondedAt?: Date;
  notes?: Array<{
    addedBy: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
  }>;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sourcedCandidateSchema = new Schema<ISourcedCandidateDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    sourcedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    platform: {
      type: String,
      enum: Object.values(SourcingPlatform),
      required: true,
    },
    externalId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: String,
    phone: String,
    location: String,
    currentCompany: String,
    currentPosition: String,
    experience: Number,
    skills: [String],
    education: [String],
    summary: String,
    profileUrl: String,
    resumeUrl: String,
    imageUrl: String,
    lastActive: Date,
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    matchDetails: {
      skillScore: Number,
      experienceScore: Number,
      locationScore: Number,
      semanticScore: Number,
      recencyScore: Number,
      overallScore: Number,
      strengths: [String],
      missingSkills: [String],
      recommendation: String,
      confidenceScore: Number,
    },
    githubData: {
      username: String,
      publicRepos: Number,
      followers: Number,
      contributions: Number,
      topLanguages: [String],
      topRepos: [
        {
          name: String,
          description: String,
          stars: Number,
          language: String,
          url: String,
        },
      ],
      techStackScore: Number,
    },
    status: {
      type: String,
      enum: ['sourced', 'shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected', 'saved'],
      default: 'sourced',
    },
    contactedAt: Date,
    respondedAt: Date,
    notes: [
      {
        addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    deletedAt: Date,
  },
  { timestamps: true }
);

// Indexes — tenant isolation + dedup
sourcedCandidateSchema.index({ companyId: 1, platform: 1, externalId: 1 }, { unique: true });
sourcedCandidateSchema.index({ companyId: 1, jobId: 1, matchScore: -1 });
sourcedCandidateSchema.index({ companyId: 1, status: 1 });
sourcedCandidateSchema.index({ companyId: 1, deletedAt: 1 });
sourcedCandidateSchema.index({ skills: 1 });

export const SourcedCandidate = mongoose.model<ISourcedCandidateDocument>(
  'SourcedCandidate',
  sourcedCandidateSchema
);
