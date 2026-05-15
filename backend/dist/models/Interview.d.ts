import mongoose, { Document } from 'mongoose';
import { InterviewStatus, InterviewRound, CalendarProvider } from '../types';
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
    duration: number;
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
export declare const Interview: mongoose.Model<IInterviewDocument, {}, {}, {}, mongoose.Document<unknown, {}, IInterviewDocument, {}, {}> & IInterviewDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export {};
//# sourceMappingURL=Interview.d.ts.map