import mongoose, { Schema, Document } from 'mongoose';
import { QuestionDifficulty } from '../types';

export interface IQuestionDocument extends Document {
  companyId?: mongoose.Types.ObjectId;
  question: string;
  questionType: 'technical' | 'behavioral' | 'situational' | 'coding' | 'system_design';
  difficulty: QuestionDifficulty;
  skills: string[];
  expectedAnswer?: string;
  hints?: string[];
  estimatedDuration: number; // in minutes
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  usageCount: number;
  averageRating?: number;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestionDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    question: {
      type: String,
      required: [true, 'Question is required'],
    },
    questionType: {
      type: String,
      enum: ['technical', 'behavioral', 'situational', 'coding', 'system_design'],
      required: true,
    },
    difficulty: {
      type: String,
      enum: Object.values(QuestionDifficulty),
      required: true,
    },
    skills: {
      type: [String],
      required: true,
    },
    expectedAnswer: String,
    hints: [String],
    estimatedDuration: {
      type: Number,
      required: true,
      default: 5,
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
    averageRating: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
questionSchema.index({ companyId: 1, difficulty: 1 });
questionSchema.index({ skills: 1 });
questionSchema.index({ isActive: 1 });

export const Question = mongoose.model<IQuestionDocument>('Question', questionSchema);
