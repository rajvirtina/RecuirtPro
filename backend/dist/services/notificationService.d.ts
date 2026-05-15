interface CreateNotificationInput {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    data?: any;
    expiresAt?: Date;
}
declare class NotificationService {
    /**
     * Create an in-app notification
     */
    createNotification(input: CreateNotificationInput): Promise<import("mongoose").Document<unknown, {}, import("../models").INotificationDocument, {}, {}> & import("../models").INotificationDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    /**
     * Create bulk notifications (e.g., for all HR users in a company)
     */
    createBulkNotifications(userIds: string[], notification: Omit<CreateNotificationInput, 'userId'>): Promise<import("mongoose").MergeType<import("mongoose").Document<unknown, {}, import("../models").INotificationDocument, {}, {}> & import("../models").INotificationDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, Omit<{
        userId: string;
        type: string;
        title: string;
        message: string;
        priority: "low" | "high" | "medium" | "urgent";
        data: any;
        sentAt: Date;
    }, "_id">>[]>;
    notifyApplicationReceived(companyHrUserIds: string[], applicantName: string, jobTitle: string, applicationId: string): Promise<void>;
    notifyInterviewScheduled(candidateId: string, jobTitle: string, scheduledTime: Date, interviewId: string): Promise<void>;
    notifyStatusChange(candidateId: string, jobTitle: string, newStatus: string, applicationId: string): Promise<void>;
    notifyOfferReceived(candidateId: string, designation: string, companyName: string, offerId: string): Promise<void>;
}
export declare const notificationService: NotificationService;
export {};
//# sourceMappingURL=notificationService.d.ts.map