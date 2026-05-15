"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkApplicationStatus = exports.downloadResume = exports.getApplicationStats = exports.withdrawApplication = exports.updateApplicationStatus = exports.getApplicationById = exports.getApplications = exports.submitApplication = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Submit a job application
 * @route   POST /api/v1/applications
 * @access  Private (Candidate)
 */
const submitApplication = async (req, res) => {
    try {
        const { jobId, coverLetter, expectedSalary } = req.body;
        const userId = req.user?._id;
        // Get resume URL from uploaded file or body
        let resumeUrl = req.body.resumeUrl;
        if (req.file) {
            // File was uploaded, use the file path
            resumeUrl = `/uploads/resumes/${req.file.filename}`;
        }
        // Check if job exists and is active
        const job = await models_1.Job.findById(jobId);
        if (!job) {
            return (0, response_1.sendError)(res, 'Job not found', 404);
        }
        if (job.status !== types_1.JobStatus.PUBLISHED) {
            return (0, response_1.sendError)(res, 'Job is not accepting applications', 400);
        }
        // Check if user already applied
        const existingApplication = await models_1.Application.findOne({
            jobId,
            candidateId: userId,
            deletedAt: null,
        });
        if (existingApplication) {
            return (0, response_1.sendError)(res, 'You have already applied to this job', 400);
        }
        // Get or create candidate profile
        let candidateProfile = await models_1.CandidateProfile.findOne({ userId });
        if (!candidateProfile) {
            // Create basic candidate profile
            candidateProfile = await models_1.CandidateProfile.create({
                userId,
                resumeUrl: resumeUrl || '',
            });
        }
        // BUG-008: Use findOneAndUpdate with upsert=false to safely handle race conditions.
        // The unique index on [jobId, candidateId] catches concurrent inserts — return 409 not 500.
        let application;
        try {
            application = await models_1.Application.create({
                jobId,
                candidateId: userId,
                companyId: job.companyId,
                coverLetter,
                resumeUrl: resumeUrl || candidateProfile.resumeUrl,
                expectedSalary,
                status: types_1.ApplicationStatus.APPLIED,
            });
        }
        catch (err) {
            if (err.code === 11000) {
                // Duplicate key — concurrent insert lost the race
                return (0, response_1.sendError)(res, 'You have already applied to this job', 409);
            }
            throw err;
        }
        // DC-001: Increment application count atomically (stays in sync)
        await models_1.Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });
        logger_1.default.info(`Application submitted: ${application._id} for job: ${jobId}`);
        return (0, response_1.sendSuccess)(res, application, 'Application submitted successfully', 201);
    }
    catch (error) {
        logger_1.default.error('Error in submitApplication:', error);
        return (0, response_1.sendError)(res, error.message || 'Error submitting application', 500);
    }
};
exports.submitApplication = submitApplication;
/**
 * @desc    Get all applications (with filters)
 * @route   GET /api/v1/applications
 * @access  Private (Employer/HR/Admin for job applications, Candidate for own applications)
 */
const getApplications = async (req, res) => {
    try {
        const { page = 1, limit = 10, jobId, status, candidateId, } = req.query;
        const query = { deletedAt: null };
        // Role-based filtering
        if (req.user?.role === 'candidate') {
            // Candidates can only see their own applications
            query.candidateId = req.user._id;
        }
        else {
            // TENANT ISOLATION: All non-candidate, non-super-admin users are scoped to their company
            const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
            if (tenantId) {
                query.companyId = tenantId;
            }
        }
        // Apply filters
        if (jobId)
            query.jobId = jobId;
        if (status)
            query.status = status;
        if (candidateId && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
            query.candidateId = candidateId;
        }
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const skip = (pageNum - 1) * limitNum;
        const [applications, total] = await Promise.all([
            models_1.Application.find(query)
                .populate('jobId', 'title location companyId salaryMin salaryMax')
                .populate('candidateId', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            models_1.Application.countDocuments(query),
        ]);
        return (0, response_1.sendPaginatedResponse)(res, applications, pageNum, limitNum, total, 'Applications retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getApplications:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching applications', 500);
    }
};
exports.getApplications = getApplications;
/**
 * @desc    Get single application by ID
 * @route   GET /api/v1/applications/:id
 * @access  Private (Application owner or Employer/HR/Admin)
 */
const getApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await models_1.Application.findById(id)
            .populate('jobId')
            .populate('candidateId', '-password');
        if (!application || application.deletedAt) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Authorization check
        const isOwner = application.candidateId._id.toString() === req.user?._id;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isSuperAdminUser = (0, auth_1.isSuperAdmin)(req.user);
        // Company members can only view applications for their company's jobs
        let isAuthorizedCompanyMember = false;
        if (tenantId && application.companyId) {
            isAuthorizedCompanyMember = application.companyId.toString() === tenantId;
        }
        if (!isOwner && !isAuthorizedCompanyMember && !isSuperAdminUser) {
            return (0, response_1.sendError)(res, 'Not authorized to view this application', 403);
        }
        return (0, response_1.sendSuccess)(res, application, 'Application retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getApplicationById:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching application', 500);
    }
};
exports.getApplicationById = getApplicationById;
/**
 * @desc    Update application status
 * @route   PUT /api/v1/applications/:id/status
 * @access  Private (Employer/HR/Admin only)
 */
const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const application = await models_1.Application.findById(id);
        if (!application || application.deletedAt) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Authorization check — company isolation (SEC-15/B-16)
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isSuperAdminUser = (0, auth_1.isSuperAdmin)(req.user);
        let isAuthorizedCompanyMember = false;
        if (tenantId && application.companyId) {
            isAuthorizedCompanyMember = application.companyId.toString() === tenantId;
        }
        if (!isSuperAdminUser && !isAuthorizedCompanyMember) {
            return (0, response_1.sendError)(res, 'Not authorized to update this application', 403);
        }
        // Status transition validation (NEW-03)
        const validTransitions = {
            [types_1.ApplicationStatus.APPLIED]: [types_1.ApplicationStatus.SHORTLISTED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD, types_1.ApplicationStatus.WITHDRAWN],
            [types_1.ApplicationStatus.SHORTLISTED]: [types_1.ApplicationStatus.INTERVIEW_SCHEDULED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD, types_1.ApplicationStatus.WITHDRAWN],
            [types_1.ApplicationStatus.INTERVIEW_SCHEDULED]: [types_1.ApplicationStatus.IN_PROGRESS, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD, types_1.ApplicationStatus.WITHDRAWN],
            [types_1.ApplicationStatus.IN_PROGRESS]: [types_1.ApplicationStatus.SELECTED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD, types_1.ApplicationStatus.WITHDRAWN],
            [types_1.ApplicationStatus.SELECTED]: [types_1.ApplicationStatus.OFFER_RELEASED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD],
            [types_1.ApplicationStatus.OFFER_RELEASED]: [types_1.ApplicationStatus.HIRED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.ON_HOLD],
            [types_1.ApplicationStatus.ON_HOLD]: [types_1.ApplicationStatus.SHORTLISTED, types_1.ApplicationStatus.INTERVIEW_SCHEDULED, types_1.ApplicationStatus.REJECTED, types_1.ApplicationStatus.WITHDRAWN],
            [types_1.ApplicationStatus.HIRED]: [],
            [types_1.ApplicationStatus.REJECTED]: [],
            [types_1.ApplicationStatus.WITHDRAWN]: [],
        };
        const currentStatus = application.status;
        const allowedNext = validTransitions[currentStatus] || [];
        if (!allowedNext.includes(status)) {
            return (0, response_1.sendError)(res, `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowedNext.join(', ') || 'none (terminal state)'}`, 400);
        }
        // Update status
        application.status = status;
        // Add note if provided
        if (notes) {
            application.notes.push({
                addedBy: req.user?._id,
                note: notes,
                createdAt: new Date(),
            });
        }
        // Add status change to statusHistory
        application.statusHistory.push({
            status,
            changedAt: new Date(),
            changedBy: req.user?._id,
            remarks: notes,
        });
        await application.save();
        logger_1.default.info(`Application ${id} status updated to ${status} by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, application, 'Application status updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateApplicationStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating application status', 500);
    }
};
exports.updateApplicationStatus = updateApplicationStatus;
/**
 * @desc    Withdraw application
 * @route   DELETE /api/v1/applications/:id
 * @access  Private (Candidate - application owner only)
 */
const withdrawApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await models_1.Application.findById(id);
        if (!application || application.deletedAt) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Only candidate who submitted can withdraw
        if (application.candidateId.toString() !== req.user?._id) {
            return (0, response_1.sendError)(res, 'Not authorized to withdraw this application', 403);
        }
        // Cannot withdraw if already in interview or hired
        if ([types_1.ApplicationStatus.HIRED, types_1.ApplicationStatus.IN_PROGRESS].includes(application.status)) {
            return (0, response_1.sendError)(res, `Cannot withdraw application in ${application.status} status`, 400);
        }
        // Hard delete
        await models_1.Application.findByIdAndDelete(id);
        // Decrement application count on job
        await models_1.Job.findByIdAndUpdate(application.jobId, {
            $inc: { applicationCount: -1 },
        });
        logger_1.default.info(`Application ${id} withdrawn by candidate ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, null, 'Application withdrawn successfully');
    }
    catch (error) {
        logger_1.default.error('Error in withdrawApplication:', error);
        return (0, response_1.sendError)(res, error.message || 'Error withdrawing application', 500);
    }
};
exports.withdrawApplication = withdrawApplication;
/**
 * @desc    Get application statistics
 * @route   GET /api/v1/applications/stats
 * @access  Private (Employer/HR/Admin)
 */
const getApplicationStats = async (req, res) => {
    try {
        const { jobId } = req.query;
        const matchQuery = { deletedAt: null };
        // Role-based filtering
        if (req.user?.role === 'employer' || req.user?.role === 'hr' || req.user?.role === 'admin') {
            // TENANT ISOLATION: Scope to company
            const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
            if (tenantId) {
                matchQuery.companyId = tenantId;
            }
        }
        if (jobId) {
            matchQuery.jobId = jobId;
        }
        const stats = await models_1.Application.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);
        const total = await models_1.Application.countDocuments(matchQuery);
        const formattedStats = {
            total,
            byStatus: stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
        };
        return (0, response_1.sendSuccess)(res, formattedStats, 'Application statistics retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getApplicationStats:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching statistics', 500);
    }
};
exports.getApplicationStats = getApplicationStats;
/**
 * @desc    Download resume for an application
 * @route   GET /api/v1/applications/:id/resume
 * @access  Private (HR/Employer/Admin or application owner)
 */
const downloadResume = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await models_1.Application.findById(id);
        if (!application) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Check authorization
        const isOwner = application.candidateId.toString() === req.user?._id;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isCompanyMember = tenantId ? application.companyId?.toString() === tenantId : false;
        const isSuperAdminUser = (0, auth_1.isSuperAdmin)(req.user);
        if (!isOwner && !isCompanyMember && !isSuperAdminUser) {
            return (0, response_1.sendError)(res, 'Not authorized to download this resume', 403);
        }
        if (!application.resumeUrl) {
            return (0, response_1.sendError)(res, 'No resume uploaded for this application', 404);
        }
        // Prevent path traversal (SEC-04/B-05)
        const path = require('path');
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        const filePath = path.resolve(__dirname, '../../', application.resumeUrl);
        // Ensure resolved path stays within the uploads directory
        if (!filePath.startsWith(uploadsDir)) {
            logger_1.default.warn(`[downloadResume] Path traversal attempt blocked: ${application.resumeUrl}`);
            return (0, response_1.sendError)(res, 'Invalid resume path', 400);
        }
        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            return (0, response_1.sendError)(res, 'Resume file not found', 404);
        }
        // Send file
        return res.download(filePath, (err) => {
            if (err) {
                logger_1.default.error('Error downloading resume:', err);
                if (!res.headersSent) {
                    return (0, response_1.sendError)(res, 'Error downloading resume', 500);
                }
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error in downloadResume:', error);
        return (0, response_1.sendError)(res, error.message || 'Error downloading resume', 500);
    }
};
exports.downloadResume = downloadResume;
/**
 * @desc    Check if candidate has applied to a job
 * @route   GET /api/v1/applications/check/:jobId
 * @access  Private (Candidate)
 */
const checkApplicationStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?._id;
        const application = await models_1.Application.findOne({
            jobId,
            candidateId: userId,
            deletedAt: null,
        });
        return (0, response_1.sendSuccess)(res, {
            hasApplied: !!application,
            application: application ? {
                _id: application._id,
                status: application.status,
                appliedAt: application.createdAt,
            } : null,
        }, 'Application status retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in checkApplicationStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Error checking application status', 500);
    }
};
exports.checkApplicationStatus = checkApplicationStatus;
//# sourceMappingURL=applicationController.js.map