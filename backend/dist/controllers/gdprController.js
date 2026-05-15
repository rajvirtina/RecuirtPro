"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawConsent = exports.getConsentHistory = exports.requestAccountDeletion = exports.exportUserData = void 0;
const response_1 = require("../utils/response");
const User_1 = require("../models/User");
const CandidateProfile_1 = require("../models/CandidateProfile");
const Application_1 = require("../models/Application");
const Interview_1 = require("../models/Interview");
const ProctoringEvent_1 = require("../models/ProctoringEvent");
const ConsentLog_1 = __importDefault(require("../models/ConsentLog"));
const AuditLog_1 = require("../models/AuditLog");
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * GDPR Controller
 * Handles data subject rights: access, portability, erasure, restriction
 */
/**
 * Export all personal data for a user (GDPR Article 15 & 20)
 * GET /api/gdpr/export
 */
const exportUserData = async (req, res) => {
    try {
        const userId = req.user._id;
        logger_1.default.info(`Data export requested by user ${userId}`);
        // Collect all personal data
        const userData = await User_1.User.findById(userId).select('-password').lean();
        if (!userData) {
            return (0, response_1.sendError)(res, 'User not found', 404);
        }
        // Candidate profile
        const candidateProfile = await CandidateProfile_1.CandidateProfile.findOne({ userId }).lean();
        // Applications
        const applications = await Application_1.Application.find({ candidateId: userId })
            .populate('jobId', 'title company')
            .lean();
        // Interviews
        const interviews = await Interview_1.Interview.find({ candidateId: userId })
            .populate('jobId', 'title')
            .lean();
        // Proctoring events
        const proctoringEvents = await ProctoringEvent_1.ProctoringEvent.find({ candidateId: userId }).lean();
        // Consent logs
        const consentLogs = await ConsentLog_1.default.find({ userId }).lean();
        // Audit logs (limited to user's own actions)
        const auditLogs = await AuditLog_1.AuditLog.find({ userId }).limit(1000).lean();
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
        await AuditLog_1.AuditLog.create({
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
        return (0, response_1.sendSuccess)(res, exportData, 'Personal data exported successfully. Please store this data securely.', 200);
    }
    catch (error) {
        logger_1.default.error('Error exporting user data:', error);
        return (0, response_1.sendError)(res, 'Failed to export data', 500);
    }
};
exports.exportUserData = exportUserData;
/**
 * Request account deletion (GDPR Article 17)
 * DELETE /api/gdpr/delete-account
 */
const requestAccountDeletion = async (req, res) => {
    try {
        const userId = req.user._id;
        const { reason, confirmEmail } = req.body;
        const user = await User_1.User.findById(userId);
        if (!user) {
            return (0, response_1.sendError)(res, 'User not found', 404);
        }
        // Verify email confirmation
        if (confirmEmail !== user.email) {
            return (0, response_1.sendError)(res, 'Email confirmation does not match', 400);
        }
        logger_1.default.info(`Account deletion requested by user ${userId} (${user.email})`);
        // Check if user has pending interviews
        const upcomingInterviews = await Interview_1.Interview.find({
            candidateId: userId,
            status: { $in: ['scheduled', 'confirmed'] },
            scheduledAt: { $gt: new Date() },
        });
        if (upcomingInterviews.length > 0) {
            return (0, response_1.sendError)(res, 'Cannot delete account with upcoming interviews. Please cancel or complete them first.', 400);
        }
        // Start deletion process
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. Anonymize applications (keep for company records)
            await Application_1.Application.updateMany({ candidateId: userId }, {
                $set: {
                    'metadata.anonymized': true,
                    'metadata.anonymizedAt': new Date(),
                    'metadata.originalUserId': userId,
                },
            }, { session });
            // 2. Anonymize interviews (keep for audit trail)
            await Interview_1.Interview.updateMany({ candidateId: userId }, {
                $set: {
                    'metadata.anonymized': true,
                    'metadata.anonymizedAt': new Date(),
                },
            }, { session });
            // 3. Delete proctoring events (after retention period or anonymize)
            await ProctoringEvent_1.ProctoringEvent.updateMany({ candidateId: userId }, {
                $set: {
                    candidateId: new mongoose_1.default.Types.ObjectId('000000000000000000000000'), // Dummy ID
                    'metadata.anonymized': true,
                },
            }, { session });
            // 4. Record withdrawal of all consents
            await ConsentLog_1.default.create([
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
            ], { session });
            // 5. Delete candidate profile
            await CandidateProfile_1.CandidateProfile.deleteOne({ userId }, { session });
            // 6. Log the deletion
            await AuditLog_1.AuditLog.create([
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
            ], { session });
            // 7. Mark user as deleted (soft delete for audit trail)
            user.email = `deleted_${userId}@deleted.local`;
            user.firstName = 'Deleted';
            user.lastName = 'User';
            user.status = 'inactive';
            await user.save({ session });
            await session.commitTransaction();
            logger_1.default.info(`Account deleted successfully for user ${userId}`);
            return (0, response_1.sendSuccess)(res, {
                message: 'Account deletion completed',
                deletedAt: new Date(),
                dataRetained: {
                    anonymizedApplications: true,
                    anonymizedInterviews: true,
                    auditLogs: true,
                },
            }, 'Your account has been deleted. Some anonymized records may be retained for legal compliance.', 200);
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        logger_1.default.error('Error deleting account:', error);
        return (0, response_1.sendError)(res, 'Failed to delete account', 500);
    }
};
exports.requestAccountDeletion = requestAccountDeletion;
/**
 * Get consent history (GDPR Article 7)
 * GET /api/gdpr/consent-history
 */
const getConsentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const consents = await ConsentLog_1.default.find({ userId })
            .sort({ timestamp: -1 })
            .lean();
        // Group by consent type to show latest status
        const consentStatus = {};
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
        return (0, response_1.sendSuccess)(res, {
            userId,
            consentStatus,
            totalRecords: consents.length,
        }, 'Consent history retrieved successfully', 200);
    }
    catch (error) {
        logger_1.default.error('Error fetching consent history:', error);
        return (0, response_1.sendError)(res, 'Failed to fetch consent history', 500);
    }
};
exports.getConsentHistory = getConsentHistory;
/**
 * Withdraw consent for specific type (GDPR Article 7.3)
 * POST /api/gdpr/withdraw-consent
 */
const withdrawConsent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { consentType, reason } = req.body;
        if (!consentType) {
            return (0, response_1.sendError)(res, 'Consent type is required', 400);
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return (0, response_1.sendError)(res, 'User not found', 404);
        }
        // Record withdrawal
        await ConsentLog_1.default.create({
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
        logger_1.default.info(`Consent withdrawn: ${consentType} by user ${userId}`);
        return (0, response_1.sendSuccess)(res, {
            consentType,
            status: 'withdrawn',
            timestamp: new Date(),
        }, `Consent for ${consentType} has been withdrawn`, 200);
    }
    catch (error) {
        logger_1.default.error('Error withdrawing consent:', error);
        return (0, response_1.sendError)(res, 'Failed to withdraw consent', 500);
    }
};
exports.withdrawConsent = withdrawConsent;
//# sourceMappingURL=gdprController.js.map