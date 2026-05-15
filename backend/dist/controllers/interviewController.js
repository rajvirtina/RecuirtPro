"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInterview = exports.submitInterviewFeedback = exports.cancelInterview = exports.updateInterviewStatus = exports.updateInterview = exports.getInterviewById = exports.getInterviews = exports.scheduleInterview = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Schedule an interview
 * @route   POST /api/v1/interviews
 * @access  Private (Employer/HR/Admin)
 */
const scheduleInterview = async (req, res) => {
    try {
        const { applicationId, jobId, candidateId, scheduledTime, duration, mode, location, meetingLink, panel, round, interviewTemplateId, } = req.body;
        // Verify application exists
        const application = await models_1.Application.findById(applicationId);
        if (!application) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Authorization check
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            (tenantId && application.companyId?.toString() === tenantId);
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to schedule interview', 403);
        }
        // Validate scheduledTime is not in the past (EC-03)
        if (scheduledTime && new Date(scheduledTime) < new Date()) {
            return (0, response_1.sendError)(res, 'Interview cannot be scheduled in the past', 400);
        }
        // Create interview
        const interview = await models_1.Interview.create({
            jobId,
            candidateId,
            applicationId,
            companyId: application.companyId,
            scheduledTime,
            duration: duration || 60,
            mode,
            location,
            meetingLink,
            panel: panel || [],
            round: round || 'L1',
            roundNumber: 1,
            interviewTemplateId,
            status: types_1.InterviewStatus.SCHEDULED,
            scheduledBy: req.user?._id,
            createdBy: req.user?._id,
            timezone: 'Asia/Kolkata',
            isOnline: mode === 'online',
            candidateConfirmed: false,
            rescheduleCount: 0,
            proctoringEnabled: true, // Enable proctoring by default for online interviews
        });
        // Update application status
        application.status = types_1.ApplicationStatus.INTERVIEW_SCHEDULED;
        application.statusHistory.push({
            status: types_1.ApplicationStatus.INTERVIEW_SCHEDULED,
            changedAt: new Date(),
            changedBy: req.user?._id,
            remarks: `Interview scheduled for ${scheduledTime}`,
        });
        await application.save();
        logger_1.default.info(`Interview scheduled: ${interview._id} for application: ${applicationId}`);
        return (0, response_1.sendSuccess)(res, interview, 'Interview scheduled successfully', 201);
    }
    catch (error) {
        logger_1.default.error('Error in scheduleInterview:', error);
        return (0, response_1.sendError)(res, error.message || 'Error scheduling interview', 500);
    }
};
exports.scheduleInterview = scheduleInterview;
/**
 * @desc    Get all interviews (with filters)
 * @route   GET /api/v1/interviews
 * @access  Private
 */
const getInterviews = async (req, res) => {
    try {
        const { page = 1, limit = 10, jobId, candidateId, status, from, to, } = req.query;
        const query = { status: { $ne: types_1.InterviewStatus.CANCELLED } };
        // Role-based filtering
        if (req.user?.role === 'candidate') {
            query.candidateId = req.user._id;
        }
        else if (req.user?.role === 'interviewer') {
            // Interviewers see interviews where they are panel members
            query['panel.userId'] = req.user._id;
        }
        else {
            // TENANT ISOLATION: All non-candidate users scoped to company
            const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
            if (tenantId) {
                query.companyId = tenantId;
            }
        }
        // Apply filters
        if (jobId)
            query.jobId = jobId;
        if (candidateId && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
            query.candidateId = candidateId;
        }
        if (status)
            query.status = status;
        if (from || to) {
            query.scheduledTime = {};
            if (from)
                query.scheduledTime.$gte = new Date(from);
            if (to)
                query.scheduledTime.$lte = new Date(to);
        }
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const skip = (pageNum - 1) * limitNum;
        const [interviews, total] = await Promise.all([
            models_1.Interview.find(query)
                .populate('jobId', 'title location')
                .populate('candidateId', 'firstName lastName email')
                .sort({ scheduledTime: 1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            models_1.Interview.countDocuments(query),
        ]);
        // Add violation counts via a single batch query instead of N+1 (PERF-01 fix)
        const interviewIds = interviews
            .filter((i) => i.status === types_1.InterviewStatus.IN_PROGRESS || i.proctoringEnabled)
            .map((i) => i._id);
        let violationMap = {};
        if (interviewIds.length > 0) {
            const violationCounts = await models_1.ProctoringEvent.aggregate([
                { $match: { interviewId: { $in: interviewIds } } },
                { $group: { _id: '$interviewId', count: { $sum: 1 } } },
            ]);
            violationMap = violationCounts.reduce((acc, v) => {
                acc[v._id.toString()] = v.count;
                return acc;
            }, {});
        }
        const interviewsWithViolations = interviews.map((interview) => {
            if (interview.status === types_1.InterviewStatus.IN_PROGRESS || interview.proctoringEnabled) {
                return { ...interview, violations: violationMap[interview._id.toString()] || 0 };
            }
            return interview;
        });
        return (0, response_1.sendPaginatedResponse)(res, interviewsWithViolations, pageNum, limitNum, total, 'Interviews retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getInterviews:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching interviews', 500);
    }
};
exports.getInterviews = getInterviews;
/**
 * @desc    Get single interview by ID
 * @route   GET /api/v1/interviews/:id
 * @access  Private
 */
const getInterviewById = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await models_1.Interview.findById(id)
            .populate('jobId')
            .populate('candidateId', '-password')
            .populate('applicationId')
            .populate('panel.userId', 'firstName lastName email');
        if (!interview || interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — company isolation (4.6/SEC-15)
        const isCandidate = interview.candidateId._id.toString() === req.user?._id;
        const isPanelMember = interview.panel.some((member) => member.userId?._id.toString() === req.user?._id);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        let isCompanyMember = false;
        if (tenantId && interview.companyId) {
            isCompanyMember = interview.companyId.toString() === tenantId;
        }
        if (!isCandidate && !isCompanyMember && !isPanelMember && !(0, auth_1.isSuperAdmin)(req.user)) {
            return (0, response_1.sendError)(res, 'Not authorized to view this interview', 403);
        }
        return (0, response_1.sendSuccess)(res, interview, 'Interview retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getInterviewById:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching interview', 500);
    }
};
exports.getInterviewById = getInterviewById;
/**
 * @desc    Update interview (reschedule, update details)
 * @route   PUT /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
const updateInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const interview = await models_1.Interview.findById(id);
        if (!interview || interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — company isolation (4.5/SEC-15)
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        let isCompanyMember = false;
        if (tenantId && interview.companyId) {
            isCompanyMember = interview.companyId.toString() === tenantId;
        }
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) || isCompanyMember;
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to update this interview', 403);
        }
        // Update allowed fields
        const allowedUpdates = [
            'scheduledTime',
            'duration',
            'mode',
            'location',
            'meetingLink',
            'panel',
            'instructions',
        ];
        Object.keys(updates).forEach((key) => {
            if (allowedUpdates.includes(key)) {
                interview[key] = updates[key];
            }
        });
        // If rescheduling, validate and update status (EC-03)
        if (updates.scheduledTime && updates.scheduledTime !== interview.scheduledTime) {
            if (new Date(updates.scheduledTime) < new Date()) {
                return (0, response_1.sendError)(res, 'Interview cannot be rescheduled to a past date', 400);
            }
            interview.status = types_1.InterviewStatus.RESCHEDULED;
            interview.previousScheduledTime = interview.scheduledTime;
            interview.rescheduleCount += 1;
        }
        await interview.save();
        logger_1.default.info(`Interview ${id} updated by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, interview, 'Interview updated successfully');
    }
    catch (error) {
        logger_1.default.error('Error in updateInterview:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating interview', 500);
    }
};
exports.updateInterview = updateInterview;
/**
 * @desc    Update interview status
 * @route   PUT /api/v1/interviews/:id/status
 * @access  Private (Panel members, Employer/HR/Admin)
 */
const updateInterviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, feedback, rating } = req.body;
        const interview = await models_1.Interview.findById(id);
        if (!interview || interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — company isolation (4.5/SEC-15)
        const isPanelMember = interview.panel.some((member) => member.userId.toString() === req.user?._id);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        let isCompanyMember = false;
        if (tenantId && interview.companyId) {
            isCompanyMember = interview.companyId.toString() === tenantId;
        }
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            isPanelMember ||
            isCompanyMember;
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to update interview status', 403);
        }
        interview.status = status;
        // Add feedback if provided
        if (feedback) {
            interview.feedback.push({
                interviewerId: req.user?._id,
                rating: rating || 0,
                comments: feedback,
                submittedAt: new Date(),
            });
        }
        await interview.save();
        // Update application status if interview is completed
        if (status === types_1.InterviewStatus.COMPLETED) {
            const application = await models_1.Application.findById(interview.applicationId);
            if (application) {
                application.status = types_1.ApplicationStatus.IN_PROGRESS;
                await application.save();
            }
        }
        logger_1.default.info(`Interview ${id} status updated to ${status}`);
        return (0, response_1.sendSuccess)(res, interview, 'Interview status updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateInterviewStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating interview status', 500);
    }
};
exports.updateInterviewStatus = updateInterviewStatus;
/**
 * @desc    Cancel interview
 * @route   DELETE /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
const cancelInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const interview = await models_1.Interview.findById(id);
        if (!interview || interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview cancelled already or not found', 404);
        }
        // Authorization check
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            (tenantId && interview.companyId?.toString() === tenantId);
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to cancel this interview', 403);
        }
        // Soft cancel — set status to CANCELLED instead of hard delete (GAP-03)
        interview.status = types_1.InterviewStatus.CANCELLED;
        if (reason) {
            interview.cancellationReason = reason;
        }
        interview.cancelledBy = req.user?._id;
        interview.cancelledAt = new Date();
        await interview.save();
        logger_1.default.info(`Interview ${id} cancelled by ${req.user?._id}. Reason: ${reason || 'N/A'}`);
        return (0, response_1.sendSuccess)(res, interview, 'Interview cancelled successfully');
    }
    catch (error) {
        logger_1.default.error('Error in cancelInterview:', error);
        return (0, response_1.sendError)(res, error.message || 'Error cancelling interview', 500);
    }
};
exports.cancelInterview = cancelInterview;
/**
 * @desc    Submit interview feedback and next round decision
 * @route   POST /api/v1/interviews/:id/feedback
 * @access  Private (Panel members, Employer/HR/Admin)
 */
const submitInterviewFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comments, recommendation, finalDecision } = req.body;
        if (!rating || !comments || !recommendation || !finalDecision) {
            return (0, response_1.sendError)(res, 'Rating, comments, recommendation, and final decision are required', 400);
        }
        const interview = await models_1.Interview.findById(id);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — company isolation (SEC-15)
        const isPanelMember = interview.panel.some((member) => member.userId.toString() === req.user?._id);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        let isCompanyMember = false;
        if (tenantId && interview.companyId) {
            isCompanyMember = interview.companyId.toString() === tenantId;
        }
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            isPanelMember ||
            isCompanyMember;
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to submit feedback for this interview', 403);
        }
        // Add feedback
        interview.feedback.push({
            interviewerId: req.user?._id,
            rating,
            comments,
            recommendation,
            submittedAt: new Date(),
        });
        // Set final decision for next round
        interview.finalDecision = finalDecision;
        // Calculate overall rating manually
        if (interview.feedback && interview.feedback.length > 0) {
            const totalRating = interview.feedback.reduce((sum, fb) => sum + fb.rating, 0);
            interview.overallRating = totalRating / interview.feedback.length;
        }
        await interview.save();
        logger_1.default.info(`Feedback submitted for interview ${id} by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, interview, 'Feedback submitted successfully');
    }
    catch (error) {
        logger_1.default.error('Error in submitInterviewFeedback:', error);
        return (0, response_1.sendError)(res, error.message || 'Error submitting feedback', 500);
    }
};
exports.submitInterviewFeedback = submitInterviewFeedback;
/**
 * @desc    Start interview - mark as in progress and generate questions using LLM
 * @route   POST /api/v1/interviews/:id/start
 * @access  Private (Panel members, Employer/HR/Admin, Candidate)
 */
const startInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await models_1.Interview.findById(id)
            .populate('jobId')
            .populate('candidateId', '-password')
            .populate('panel.userId', 'firstName lastName email');
        if (!interview || interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — company isolation (B-17)
        const isCandidate = interview.candidateId._id.toString() === req.user?._id;
        const isPanelMember = interview.panel.some((member) => member.userId?._id.toString() === req.user?._id);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        let isCompanyMember = false;
        if (tenantId && interview.companyId) {
            isCompanyMember = interview.companyId.toString() === tenantId;
        }
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            isPanelMember ||
            isCandidate ||
            isCompanyMember;
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to start this interview', 403);
        }
        // Check if already in progress or completed
        if (interview.status === types_1.InterviewStatus.IN_PROGRESS) {
            return (0, response_1.sendSuccess)(res, interview, 'Interview already in progress');
        }
        if (interview.status === types_1.InterviewStatus.COMPLETED) {
            return (0, response_1.sendError)(res, 'Interview already completed', 400);
        }
        // Update status to in progress
        interview.status = types_1.InterviewStatus.IN_PROGRESS;
        interview.startedAt = new Date();
        await interview.save();
        logger_1.default.info(`Interview ${id} started by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, interview, 'Interview started successfully');
    }
    catch (error) {
        logger_1.default.error('Error in startInterview:', error);
        return (0, response_1.sendError)(res, error.message || 'Error starting interview', 500);
    }
};
exports.startInterview = startInterview;
//# sourceMappingURL=interviewController.js.map