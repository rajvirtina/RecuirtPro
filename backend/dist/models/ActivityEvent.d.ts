import mongoose, { Document } from 'mongoose';
export declare const ACTIVITY_EVENT_TYPES: readonly ["application_submitted", "stage_changed", "note_added", "email_sent", "interview_scheduled", "interview_completed", "status_changed", "resume_parsed", "ai_score_updated", "viewed"];
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];
export interface IActivityEventDocument extends Document {
    applicationId: mongoose.Types.ObjectId;
    actorId: mongoose.Types.ObjectId;
    actorName: string;
    type: ActivityEventType;
    metadata: Record<string, any>;
    createdAt: Date;
}
export declare const ActivityEvent: mongoose.Model<IActivityEventDocument, {}, {}, {}, mongoose.Document<unknown, {}, IActivityEventDocument, {}, {}> & IActivityEventDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ActivityEvent.d.ts.map