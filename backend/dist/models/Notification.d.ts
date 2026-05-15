import mongoose, { Document } from 'mongoose';
import { NotificationType } from '../types';
export interface INotificationDocument extends Document {
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    read: boolean;
    readAt?: Date;
    sentAt?: Date;
    emailSent: boolean;
    smsSent: boolean;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Notification: mongoose.Model<INotificationDocument, {}, {}, {}, mongoose.Document<unknown, {}, INotificationDocument, {}, {}> & INotificationDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Notification.d.ts.map