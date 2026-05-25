"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const socketController_1 = require("../socket/socketController");
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
            // Real-time push — frontend invalidates its query cache on receipt
            try {
                (0, socketController_1.emitNotificationToUser)(input.userId, {
                    _id: notification._id?.toString(),
                    title: input.title,
                    message: input.message,
                    priority: input.priority || 'medium',
                    data: input.data,
                });
            }
            catch {
                // Socket may not be ready yet (e.g., test env) — swallow silently
            }
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
            // Real-time push to each recipient
            try {
                userIds.forEach((userId) => (0, socketController_1.emitNotificationToUser)(userId, {
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority || 'medium',
                    data: notification.data,
                }));
            }
            catch {
                // Swallow — socket may be unready
            }
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
    /** Offer accepted or rejected by candidate → notify HR team */
    async notifyOfferActioned(hrUserIds, candidateName, designation, decision, offerId) {
        const accepted = decision === 'accepted';
        await this.createBulkNotifications(hrUserIds, {
            type: types_1.NotificationType.IN_APP,
            title: accepted ? 'Offer Accepted 🎉' : 'Offer Declined',
            message: `${candidateName} has ${decision} the offer for ${designation}.`,
            priority: accepted ? 'high' : 'medium',
            data: { offerId, type: 'offer_actioned', decision },
        });
    }
    /** AI interview session completed → notify HR/panel */
    async notifyAIInterviewCompleted(hrUserIds, candidateName, jobTitle, recommendation, interviewId) {
        const recLabel = {
            strong_hire: '✅ Strong Hire',
            hire: '✅ Hire',
            hold: '⏸ On Hold',
            reject: '❌ Not Recommended',
        };
        await this.createBulkNotifications(hrUserIds, {
            type: types_1.NotificationType.IN_APP,
            title: 'AI Interview Completed',
            message: `${candidateName}'s AI interview for ${jobTitle} is done. Recommendation: ${recLabel[recommendation] ?? recommendation}`,
            priority: 'high',
            data: { interviewId, type: 'ai_interview_completed', recommendation },
        });
    }
    /** High/critical proctoring violation → notify HR immediately */
    async notifyProctoringViolation(hrUserIds, candidateName, violationType, severity, interviewId) {
        await this.createBulkNotifications(hrUserIds, {
            type: types_1.NotificationType.IN_APP,
            title: `Proctoring Alert — ${severity === 'critical' ? '🚨 Critical' : '⚠️ High'} Severity`,
            message: `${candidateName}: ${violationType.replace(/_/g, ' ')}`,
            priority: severity === 'critical' ? 'urgent' : 'high',
            data: { interviewId, type: 'proctoring_violation', violationType, severity },
        });
    }
}
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map