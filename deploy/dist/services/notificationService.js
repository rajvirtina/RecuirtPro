"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
class NotificationService {
    /**
     * Create an in-app notification
     */
    async createNotification(input) {
        try {
            const notification = await models_1.Notification.create({
                userId: input.userId,
                type: input.type || types_1.NotificationType.IN_APP,
                title: input.title,
                message: input.message,
                priority: input.priority || 'medium',
                data: input.data,
                expiresAt: input.expiresAt,
                sentAt: new Date(),
            });
            logger_1.default.info(`Notification created for user ${input.userId}: ${input.title}`);
            return notification;
        }
        catch (error) {
            logger_1.default.error('Error creating notification:', error);
            throw error;
        }
    }
    /**
     * Create bulk notifications (e.g., for all HR users in a company)
     */
    async createBulkNotifications(userIds, notification) {
        const notifications = userIds.map(userId => ({
            userId,
            type: notification.type || types_1.NotificationType.IN_APP,
            title: notification.title,
            message: notification.message,
            priority: notification.priority || 'medium',
            data: notification.data,
            sentAt: new Date(),
        }));
        try {
            const created = await models_1.Notification.insertMany(notifications);
            logger_1.default.info(`Bulk notifications created: ${created.length} for ${userIds.length} users`);
            return created;
        }
        catch (error) {
            logger_1.default.error('Error creating bulk notifications:', error);
            throw error;
        }
    }
    // ============================================================
    // EVENT-BASED NOTIFICATION TRIGGERS
    // ============================================================
    async notifyApplicationReceived(companyHrUserIds, applicantName, jobTitle, applicationId) {
        await this.createBulkNotifications(companyHrUserIds, {
            type: types_1.NotificationType.IN_APP,
            title: 'New Application Received',
            message: `${applicantName} applied for ${jobTitle}`,
            priority: 'medium',
            data: { applicationId, type: 'application_received' },
        });
    }
    async notifyInterviewScheduled(candidateId, jobTitle, scheduledTime, interviewId) {
        await this.createNotification({
            userId: candidateId,
            type: types_1.NotificationType.IN_APP,
            title: 'Interview Scheduled',
            message: `Your interview for ${jobTitle} is scheduled for ${scheduledTime.toLocaleString()}`,
            priority: 'high',
            data: { interviewId, type: 'interview_scheduled' },
        });
    }
    async notifyStatusChange(candidateId, jobTitle, newStatus, applicationId) {
        await this.createNotification({
            userId: candidateId,
            type: types_1.NotificationType.IN_APP,
            title: 'Application Status Updated',
            message: `Your application for ${jobTitle} has been updated to: ${newStatus.replace(/_/g, ' ')}`,
            priority: 'medium',
            data: { applicationId, status: newStatus, type: 'status_change' },
        });
    }
    async notifyOfferReceived(candidateId, designation, companyName, offerId) {
        await this.createNotification({
            userId: candidateId,
            type: types_1.NotificationType.IN_APP,
            title: 'Offer Letter Received',
            message: `You have received an offer for ${designation} at ${companyName}. Please review and respond.`,
            priority: 'urgent',
            data: { offerId, type: 'offer_received' },
        });
    }
}
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map