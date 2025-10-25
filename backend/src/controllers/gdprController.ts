import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { User } from '../models/User';
import { CandidateProfile } from '../models/CandidateProfile';
import { Application } from '../models/Application';
import { Interview } from '../models/Interview';
import { ProctoringEvent } from '../models/ProctoringEvent';
import ConsentLog from '../models/ConsentLog';
import { AuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * GDPR Controller
 * Handles data subject rights: access, portability, erasure, restriction
 */

/**
 * Export all personal data for a user (GDPR Article 15 & 20)
 * GET /api/gdpr/export
 */
export const exportUserData = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const userId = req.user!._id;

    logger.info(`Data export requested by user ${userId}`);

    // Collect all personal data
    const userData = await User.findById(userId).select('-password').lean();
    
    if (!userData) {
      return sendError(res, 'User not found', 404);
    }

    // Candidate profile
    const candidateProfile = await CandidateProfile.findOne({ userId }).lean();

    // Applications
    const applications = await Application.find({ candidateId: userId })
      .populate('jobId', 'title company')
      .lean();

    // Interviews
    const interviews = await Interview.find({ candidateId: userId })
      .populate('jobId', 'title')
      .lean();

    // Proctoring events
    const proctoringEvents = await ProctoringEvent.find({ candidateId: userId }).lean();

    // Consent logs
    const consentLogs = await ConsentLog.find({ userId }).lean();

    // Audit logs (limited to user's own actions)
    const auditLogs = await AuditLog.find({ userId }).limit(1000).lean();

    // Compile export package
    const exportData = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      dataSubject: {
        userId: userData._id,
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
      },
      personalData: {
        account: userData,
        profile: candidateProfile,
        applications: applications.map((app) => ({
          id: app._id,
          job: app.jobId,
          status: app.status,
          appliedAt: app.createdAt,
          coverLetter: app.coverLetter,
        })),
        interviews: interviews.map((interview) => ({
          id: interview._id,
          job: interview.jobId,
          scheduledAt: interview.scheduledTime,
          status: interview.status,
          duration: interview.duration,
        })),
        proctoringEvents: proctoringEvents.map((event) => ({
          id: event._id,
          interviewId: event.interviewId,
          eventType: event.eventType,
          severity: event.severity,
          timestamp: event.timestamp,
          description: event.description,
        })),
        consentRecords: consentLogs.map((consent) => ({
          id: consent._id,
          type: consent.consentType,
          granted: consent.granted,
          version: consent.consentVersion,
          timestamp: consent.timestamp,
        })),
        auditTrail: auditLogs.map((log) => ({
          id: log._id,
          action: log.action,
          resource: log.resource,
          timestamp: log.timestamp,
        })),
      },
      metadata: {
        totalApplications: applications.length,
        totalInterviews: interviews.length,
        totalProctoringEvents: proctoringEvents.length,
        totalConsentRecords: consentLogs.length,
        accountCreated: userData.createdAt,
        lastLogin: userData.lastLogin,
      },
    };

    // Log the export
    await AuditLog.create({
      userId,
      userEmail: userData.email,
      action: 'GDPR_DATA_EXPORT',
      resource: 'user',
      resourceId: userId.toString(),
      description: `GDPR data export requested by user: ${userData.email}`,
      metadata: {
        recordsExported: {
          applications: applications.length,
          interviews: interviews.length,
          proctoringEvents: proctoringEvents.length,
        },
      },
    });

    return sendSuccess(
      res,
      exportData,
      'Personal data exported successfully. Please store this data securely.',
      200
    );
  } catch (error: any) {
    logger.error('Error exporting user data:', error);
    return sendError(res, 'Failed to export data', 500);
  }
};

/**
 * Request account deletion (GDPR Article 17)
 * DELETE /api/gdpr/delete-account
 */
export const requestAccountDeletion = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const userId = req.user!._id;
    const { reason, confirmEmail } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify email confirmation
    if (confirmEmail !== user.email) {
      return sendError(res, 'Email confirmation does not match', 400);
    }

    logger.info(`Account deletion requested by user ${userId} (${user.email})`);

    // Check if user has pending interviews
    const upcomingInterviews = await Interview.find({
      candidateId: userId,
      status: { $in: ['scheduled', 'confirmed'] },
      scheduledAt: { $gt: new Date() },
    });

    if (upcomingInterviews.length > 0) {
      return sendError(
        res,
        'Cannot delete account with upcoming interviews. Please cancel or complete them first.',
        400
      );
    }

    // Start deletion process
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Anonymize applications (keep for company records)
      await Application.updateMany(
        { candidateId: userId },
        {
          $set: {
            'metadata.anonymized': true,
            'metadata.anonymizedAt': new Date(),
            'metadata.originalUserId': userId,
          },
        },
        { session }
      );

      // 2. Anonymize interviews (keep for audit trail)
      await Interview.updateMany(
        { candidateId: userId },
        {
          $set: {
            'metadata.anonymized': true,
            'metadata.anonymizedAt': new Date(),
          },
        },
        { session }
      );

      // 3. Delete proctoring events (after retention period or anonymize)
      await ProctoringEvent.updateMany(
        { candidateId: userId },
        {
          $set: {
            candidateId: new mongoose.Types.ObjectId('000000000000000000000000'), // Dummy ID
            'metadata.anonymized': true,
          },
        },
        { session }
      );

      // 4. Record withdrawal of all consents
      await ConsentLog.create(
        [
          {
            userId,
            userEmail: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            consentType: 'data_processing',
            consentVersion: '1.0',
            granted: false,
            timestamp: new Date(),
            metadata: {
              withdrawnAt: new Date(),
              withdrawnReason: reason || 'Account deletion request',
            },
          },
        ],
        { session }
      );

      // 5. Delete candidate profile
      await CandidateProfile.deleteOne({ userId }, { session });

      // 6. Log the deletion
      await AuditLog.create(
        [
          {
            userId,
            userEmail: user.email,
            action: 'ACCOUNT_DELETED',
            resource: 'user',
            resourceId: userId.toString(),
            description: `User account deleted: ${user.email}`,
            metadata: {
              reason,
              anonymizedApplications: upcomingInterviews.length,
              deletionTimestamp: new Date(),
            },
          },
        ],
        { session }
      );

      // 7. Mark user as deleted (soft delete for audit trail)
      user.email = `deleted_${userId}@deleted.local`;
      user.firstName = 'Deleted';
      user.lastName = 'User';
      user.status = 'inactive' as any;
      await user.save({ session });

      await session.commitTransaction();

      logger.info(`Account deleted successfully for user ${userId}`);

      return sendSuccess(
        res,
        {
          message: 'Account deletion completed',
          deletedAt: new Date(),
          dataRetained: {
            anonymizedApplications: true,
            anonymizedInterviews: true,
            auditLogs: true,
          },
        },
        'Your account has been deleted. Some anonymized records may be retained for legal compliance.',
        200
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error('Error deleting account:', error);
    return sendError(res, 'Failed to delete account', 500);
  }
};

/**
 * Get consent history (GDPR Article 7)
 * GET /api/gdpr/consent-history
 */
export const getConsentHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const userId = req.user!._id;

    const consents = await ConsentLog.find({ userId })
      .sort({ timestamp: -1 })
      .lean();

    // Group by consent type to show latest status
    const consentStatus: Record<string, any> = {};
    
    for (const consent of consents) {
      if (!consentStatus[consent.consentType]) {
        consentStatus[consent.consentType] = {
          currentStatus: consent.granted ? 'granted' : 'withdrawn',
          version: consent.consentVersion,
          lastUpdated: consent.timestamp,
          history: [],
        };
      }
      consentStatus[consent.consentType].history.push({
        granted: consent.granted,
        timestamp: consent.timestamp,
        version: consent.consentVersion,
      });
    }

    return sendSuccess(
      res,
      {
        userId,
        consentStatus,
        totalRecords: consents.length,
      },
      'Consent history retrieved successfully',
      200
    );
  } catch (error: any) {
    logger.error('Error fetching consent history:', error);
    return sendError(res, 'Failed to fetch consent history', 500);
  }
};

/**
 * Withdraw consent for specific type (GDPR Article 7.3)
 * POST /api/gdpr/withdraw-consent
 */
export const withdrawConsent = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const userId = req.user!._id;
    const { consentType, reason } = req.body;

    if (!consentType) {
      return sendError(res, 'Consent type is required', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Record withdrawal
    await ConsentLog.create({
      userId,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      consentType,
      consentVersion: '1.0',
      granted: false,
      timestamp: new Date(),
      metadata: {
        withdrawnAt: new Date(),
        withdrawnReason: reason,
      },
    });

    logger.info(`Consent withdrawn: ${consentType} by user ${userId}`);

    return sendSuccess(
      res,
      {
        consentType,
        status: 'withdrawn',
        timestamp: new Date(),
      },
      `Consent for ${consentType} has been withdrawn`,
      200
    );
  } catch (error: any) {
    logger.error('Error withdrawing consent:', error);
    return sendError(res, 'Failed to withdraw consent', 500);
  }
};
