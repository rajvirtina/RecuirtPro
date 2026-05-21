import mongoose, { Schema, Document } from 'mongoose';

export const ACTIVITY_EVENT_TYPES = [
  'application_submitted',
  'stage_changed',
  'note_added',
  'email_sent',
  'interview_scheduled',
  'interview_completed',
  'status_changed',
  'resume_parsed',
  'ai_score_updated',
  'viewed',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export interface IActivityEventDocument extends Document {
  applicationId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorName: string;
  type: ActivityEventType;
  metadata: Record<string, any>;
  createdAt: Date;
}

const ActivityEventSchema = new Schema<IActivityEventDocument>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    type: { type: String, enum: ACTIVITY_EVENT_TYPES, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityEventSchema.index({ applicationId: 1, createdAt: -1 });

export const ActivityEvent = mongoose.model<IActivityEventDocument>('ActivityEvent', ActivityEventSchema);
