import { Notification } from '../models';
import { NotificationType } from '../types';
import logger from '../utils/logger';
import { emitNotificationToUser } from '../socket/socketController';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  data?: any;
  expiresAt?: Date;
}

class NotificationService {
  /**
   * Create an in-app notification
   */
  async createNotification(input: CreateNotificationInput) {
    try {
      const notification = await Notification.create({
        userId: input.userId,
        type: input.type || NotificationType.IN_APP,
        title: input.title,
        message: input.message,
        priority: input.priority || 'medium',
        data: input.data,
        expiresAt: input.expiresAt,
        sentAt: new Date(),
      });

      logger.info(`Notification created for user ${input.userId}: ${input.title}`);

      // Real-time push — frontend invalidates its query cache on receipt
      try {
        emitNotificationToUser(input.userId, {
          _id: (notification as any)._id?.toString(),
          title: input.title,
          message: input.message,
          priority: input.priority || 'medium',
          data: input.data,
        });
      } catch {
        // Socket may not be ready yet (e.g., test env) — swallow silently
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create bulk notifications (e.g., for all HR users in a company)
   */
  async createBulkNotifications(userIds: string[], notification: Omit<CreateNotificationInput, 'userId'>) {
    const notifications = userIds.map(userId => ({
      userId,
      type: notification.type || NotificationType.IN_APP,
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'medium',
      data: notification.data,
      sentAt: new Date(),
    }));

    try {
      const created = await Notification.insertMany(notifications);
      logger.info(`Bulk notifications created: ${created.length} for ${userIds.length} users`);

      // Real-time push to each recipient
      try {
        userIds.forEach((userId) =>
          emitNotificationToUser(userId, {
            title: notification.title,
            message: notification.message,
            priority: notification.priority || 'medium',
            data: notification.data,
          })
        );
      } catch {
        // Swallow — socket may be unready
      }

      return created;
    } catch (error) {
      logger.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  // ============================================================
  // EVENT-BASED NOTIFICATION TRIGGERS
  // ============================================================

  async notifyApplicationReceived(companyHrUserIds: string[], applicantName: string, jobTitle: string, applicationId: string) {
    await this.createBulkNotifications(companyHrUserIds, {
      type: NotificationType.IN_APP,
      title: 'New Application Received',
      message: `${applicantName} applied for ${jobTitle}`,
      priority: 'medium',
      data: { applicationId, type: 'application_received' },
    });
  }

  async notifyInterviewScheduled(candidateId: string, jobTitle: string, scheduledTime: Date, interviewId: string) {
    await this.createNotification({
      userId: candidateId,
      type: NotificationType.IN_APP,
      title: 'Interview Scheduled',
      message: `Your interview for ${jobTitle} is scheduled for ${scheduledTime.toLocaleString()}`,
      priority: 'high',
      data: { interviewId, type: 'interview_scheduled' },
    });
  }

  async notifyStatusChange(candidateId: string, jobTitle: string, newStatus: string, applicationId: string) {
    await this.createNotification({
      userId: candidateId,
      type: NotificationType.IN_APP,
      title: 'Application Status Updated',
      message: `Your application for ${jobTitle} has been updated to: ${newStatus.replace(/_/g, ' ')}`,
      priority: 'medium',
      data: { applicationId, status: newStatus, type: 'status_change' },
    });
  }

  async notifyOfferReceived(candidateId: string, designation: string, companyName: string, offerId: string) {
    await this.createNotification({
      userId: candidateId,
      type: NotificationType.IN_APP,
      title: 'Offer Letter Received',
      message: `You have received an offer for ${designation} at ${companyName}. Please review and respond.`,
      priority: 'urgent',
      data: { offerId, type: 'offer_received' },
    });
  }

  /** Offer accepted or rejected by candidate → notify HR team */
  async notifyOfferActioned(
    hrUserIds: string[],
    candidateName: string,
    designation: string,
    decision: 'accepted' | 'rejected',
    offerId: string
  ) {
    const accepted = decision === 'accepted';
    await this.createBulkNotifications(hrUserIds, {
      type: NotificationType.IN_APP,
      title: accepted ? 'Offer Accepted 🎉' : 'Offer Declined',
      message: `${candidateName} has ${decision} the offer for ${designation}.`,
      priority: accepted ? 'high' : 'medium',
      data: { offerId, type: 'offer_actioned', decision },
    });
  }

  /** AI interview session completed → notify HR/panel */
  async notifyAIInterviewCompleted(
    hrUserIds: string[],
    candidateName: string,
    jobTitle: string,
    recommendation: string,
    interviewId: string
  ) {
    const recLabel: Record<string, string> = {
      strong_hire: '✅ Strong Hire',
      hire:        '✅ Hire',
      hold:        '⏸ On Hold',
      reject:      '❌ Not Recommended',
    };
    await this.createBulkNotifications(hrUserIds, {
      type: NotificationType.IN_APP,
      title: 'AI Interview Completed',
      message: `${candidateName}'s AI interview for ${jobTitle} is done. Recommendation: ${recLabel[recommendation] ?? recommendation}`,
      priority: 'high',
      data: { interviewId, type: 'ai_interview_completed', recommendation },
    });
  }

  /** High/critical proctoring violation → notify HR immediately */
  async notifyProctoringViolation(
    hrUserIds: string[],
    candidateName: string,
    violationType: string,
    severity: 'high' | 'critical' | 'urgent',
    interviewId: string
  ) {
    await this.createBulkNotifications(hrUserIds, {
      type: NotificationType.IN_APP,
      title: `Proctoring Alert — ${severity === 'critical' ? '🚨 Critical' : '⚠️ High'} Severity`,
      message: `${candidateName}: ${violationType.replace(/_/g, ' ')}`,
      priority: severity === 'critical' ? 'urgent' : 'high',
      data: { interviewId, type: 'proctoring_violation', violationType, severity },
    });
  }
}

export const notificationService = new NotificationService();
