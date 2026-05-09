import mongoose, { Schema, Document } from 'mongoose';
import {
  InterviewStatus,
  InterviewRound,
  CalendarProvider,
} from '../types';

interface IPanelMember {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role?: string;
}

export interface IInterviewDocument extends Document {
  applicationId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  round: InterviewRound;
  roundNumber: number;
  scheduledTime: Date;
  duration: number; // in minutes
  timezone: string;
  status: InterviewStatus;
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  calendarProvider?: CalendarProvider;
  calendarEventId?: string;
  panel: IPanelMember[];
  questions?: mongoose.Types.ObjectId[];
  instructions?: string;
  location?: string;
  isOnline: boolean;
  candidateConfirmed: boolean;
  candidateConfirmedAt?: Date;
  rescheduleCount: number;
  previousScheduledTime?: Date;
  feedback?: Array<{
    interviewerId: mongoose.Types.ObjectId;
    rating: number;
    comments?: string;
    recommendation: 'strong_hire' | 'hire' | 'neutral' | 'no_hire' | 'strong_no_hire';
    submittedAt: Date;
  }>;
  overallRating?: number;
  finalDecision?: 'selected' | 'rejected' | 'on_hold';
  recordingUrl?: string;
  proctoringEnabled: boolean;
  proctoringConsent?: boolean;
  proctoringConsentAt?: Date;
  metadata?: {
    systemCheckCompleted?: boolean;
    systemCheckPassed?: boolean;
    systemCheckTimestamp?: Date;
    systemCheckViolations?: string[];
    [key: string]: any;
  };
  startedAt?: Date;
  completedAt?: Date;
  noShowReason?: string;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const panelMemberSchema = new Schema<IPanelMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: String,
  },
  { _id: false }
);

const interviewSchema = new Schema<IInterviewDocument>(
  {
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
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    round: {
      type: String,
      enum: Object.values(InterviewRound),
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 60,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    status: {
      type: String,
      enum: Object.values(InterviewStatus),
      default: InterviewStatus.SCHEDULED,
    },
    meetingLink: String,
    meetingId: String,
    meetingPassword: String,
    calendarProvider: {
      type: String,
      enum: Object.values(CalendarProvider),
    },
    calendarEventId: String,
    panel: [panelMemberSchema],
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    instructions: String,
    location: String,
    isOnline: {
      type: Boolean,
      default: true,
    },
    candidateConfirmed: {
      type: Boolean,
      default: false,
    },
    candidateConfirmedAt: Date,
    rescheduleCount: {
      type: Number,
      default: 0,
    },
    previousScheduledTime: Date,
    feedback: [
      {
        interviewerId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comments: String,
        recommendation: {
          type: String,
          enum: ['strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire'],
        },
        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    finalDecision: {
      type: String,
      enum: ['selected', 'rejected', 'on_hold'],
    },
    recordingUrl: String,
    proctoringEnabled: {
      type: Boolean,
      default: false,
    },
    proctoringConsent: Boolean,
    proctoringConsentAt: Date,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    startedAt: Date,
    completedAt: Date,
    noShowReason: String,
    cancellationReason: String,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
interviewSchema.index({ candidateId: 1, scheduledTime: -1 });
interviewSchema.index({ companyId: 1, status: 1 });
interviewSchema.index({ scheduledTime: 1 });
interviewSchema.index({ 'panel.userId': 1 });

// Calculate overall rating when feedback is added
interviewSchema.methods.calculateOverallRating = function () {
  if (this.feedback && this.feedback.length > 0) {
    const totalRating = this.feedback.reduce(
      (sum: number, fb: any) => sum + fb.rating,
      0
    );
    this.overallRating = totalRating / this.feedback.length;
  }
};

export const Interview = mongoose.model<IInterviewDocument>(
  'Interview',
  interviewSchema
);
