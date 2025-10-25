import mongoose, { Schema, Document } from 'mongoose';
import { InterviewTemplate as InterviewTemplateType } from '../types';

export interface IInterviewTemplateDocument extends Document {
  companyId?: mongoose.Types.ObjectId;
  name: string;
  type: InterviewTemplateType;
  description?: string;
  rounds: Array<{
    roundName: string;
    duration: number;
    questionCount: number;
    difficultyDistribution: {
      junior?: number;
      senior?: number;
      expert?: number;
    };
    skills?: string[];
  }>;
  totalDuration: number;
  passingCriteria?: {
    minimumRating: number;
    minimumRounds: number;
  };
  isDefault: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const interviewTemplateSchema = new Schema<IInterviewTemplateDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
    },
    type: {
      type: String,
      enum: Object.values(InterviewTemplateType),
      required: true,
    },
    description: String,
    rounds: [
      {
        roundName: {
          type: String,
          required: true,
        },
        duration: {
          type: Number,
          required: true,
        },
        questionCount: {
          type: Number,
          required: true,
        },
        difficultyDistribution: {
          junior: Number,
          senior: Number,
          expert: Number,
        },
        skills: [String],
      },
    ],
    totalDuration: {
      type: Number,
      required: true,
    },
    passingCriteria: {
      minimumRating: {
        type: Number,
        min: 1,
        max: 5,
      },
      minimumRounds: Number,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
interviewTemplateSchema.index({ companyId: 1, type: 1 });
interviewTemplateSchema.index({ isActive: 1, isDefault: 1 });

export const InterviewTemplate = mongoose.model<IInterviewTemplateDocument>(
  'InterviewTemplate',
  interviewTemplateSchema
);
