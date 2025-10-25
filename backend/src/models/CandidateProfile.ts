import mongoose, { Schema, Document } from 'mongoose';
import { ISkill, IEducation, IWorkExperience, IResumeSource } from '../types';

export interface ICandidateProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  resumeUrl?: string;
  resumeFileName?: string;
  skills: ISkill[];
  totalExperience: number; // in years
  currentSalary?: number;
  expectedSalary?: number;
  currency: string;
  noticePeriod?: number; // in days
  availableFrom?: Date;
  education: IEducation[];
  workExperience: IWorkExperience[];
  certifications?: Array<{
    name: string;
    issuingOrganization: string;
    issueDate?: Date;
    expiryDate?: Date;
    credentialId?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
  }>;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  source: IResumeSource;
  parsedData?: any;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<ISkill>(
  {
    name: {
      type: String,
      required: true,
    },
    yearsOfExperience: Number,
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    },
  },
  { _id: false }
);

const educationSchema = new Schema<IEducation>(
  {
    degree: {
      type: String,
      required: true,
    },
    institution: {
      type: String,
      required: true,
    },
    fieldOfStudy: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
  },
  { _id: false }
);

const workExperienceSchema = new Schema<IWorkExperience>(
  {
    company: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: Date,
    current: {
      type: Boolean,
      default: false,
    },
    description: String,
  },
  { _id: false }
);

const candidateProfileSchema = new Schema<ICandidateProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    resumeUrl: String,
    resumeFileName: String,
    skills: [skillSchema],
    totalExperience: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentSalary: {
      type: Number,
      min: 0,
    },
    expectedSalary: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    noticePeriod: {
      type: Number,
      min: 0,
    },
    availableFrom: Date,
    education: [educationSchema],
    workExperience: [workExperienceSchema],
    certifications: [
      {
        name: String,
        issuingOrganization: String,
        issueDate: Date,
        expiryDate: Date,
        credentialId: String,
      },
    ],
    languages: [
      {
        name: String,
        proficiency: {
          type: String,
          enum: ['basic', 'conversational', 'fluent', 'native'],
        },
      },
    ],
    linkedinUrl: String,
    githubUrl: String,
    portfolioUrl: String,
    source: {
      portal: String,
      externalId: String,
      url: String,
    },
    parsedData: Schema.Types.Mixed,
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
candidateProfileSchema.index({ 'skills.name': 1 });
candidateProfileSchema.index({ totalExperience: 1 });

export const CandidateProfile = mongoose.model<ICandidateProfileDocument>(
  'CandidateProfile',
  candidateProfileSchema
);
