import mongoose, { Document } from 'mongoose';
import { CalendarProvider } from '../types';
export interface ICalendarIntegrationDocument extends Document {
    userId: mongoose.Types.ObjectId;
    provider: CalendarProvider;
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    expiresAt?: Date;
    scope?: string;
    calendarId?: string;
    email: string;
    isActive: boolean;
    lastSyncedAt?: Date;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CalendarIntegration: mongoose.Model<ICalendarIntegrationDocument, {}, {}, {}, mongoose.Document<unknown, {}, ICalendarIntegrationDocument, {}, {}> & ICalendarIntegrationDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CalendarIntegration.d.ts.map