import { Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Interview, Application, Job, User, InterviewTemplate, Question, ProctoringEvent } from '../models';
import { ActivityEvent } from '../models/ActivityEvent';
import { AuthRequest, InterviewStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import logger from '../utils/logger';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { config } from '../config';
import { enqueueInterviewReminder } from '../services/queueProcessors';

/**
 * @desc    Schedule an interview
 * @route   POST /api/v1/interviews
 * @access  Private (Employer/HR/Admin)
 */
export const scheduleInterview = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      applicationId,
      scheduledTime,
      duration,
      mode,
      interviewType,
      notes,
      location,
      meetingLink,
      panel,
      round,
      interviewTemplateId,
      proctoringLevel,
    } = req.body;

    // Verify application exists
    const application = await Application.findById(applicationId);
    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    // Derive jobId / candidateId from application when not supplied by caller
    const jobId = req.body.jobId || application.jobId;
    const candidateId = req.body.candidateId || application.candidateId;

    // Authorization check
    const tenantId = getTenantCompanyId(req.user);
    const isAuthorized =
      isSuperAdmin(req.user) ||
      (tenantId && application.companyId?.toString() === tenantId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to schedule interview', 403);
    }

    // Validate scheduledTime is not in the past (EC-03)
    if (scheduledTime && new Date(scheduledTime) < new Date()) {
      return sendError(res, 'Interview cannot be scheduled in the past', 400);
    }

    // Create interview
    const interview = await Interview.create({
      jobId,
      candidateId,
      applicationId,
      companyId: application.companyId,
      scheduledTime,
      duration: duration || 60,
      mode,
      interviewType,
      notes,
      location,
      meetingLink,
      panel: panel || [],
      round: round || 'L1',
      roundNumber: 1,
      interviewTemplateId,
      status: InterviewStatus.SCHEDULED,
      scheduledBy: req.user?._id,
      createdBy: req.user?._id,
      timezone: 'Asia/Kolkata',
      isOnline: mode === 'online',
      candidateConfirmed: false,
      rescheduleCount: 0,
      proctoringEnabled: mode === 'online',
      proctoringLevel: proctoringLevel && ['none', 'basic', 'enhanced'].includes(proctoringLevel)
        ? proctoringLevel
        : mode === 'online' ? 'basic' : 'none',
    });

    // Update application status
    application.status = ApplicationStatus.INTERVIEW_SCHEDULED;
    application.statusHistory.push({
      status: ApplicationStatus.INTERVIEW_SCHEDULED,
      changedAt: new Date(),
      changedBy: req.user?._id! as any,
      remarks: `Interview scheduled for ${scheduledTime}`,
    });
    await application.save();

    // Log activity event
    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Unknown';
    await ActivityEvent.create({
      applicationId,
      actorId: req.user?._id,
      actorName,
      type: 'interview_scheduled',
      metadata: { platform: mode, scheduledAt: scheduledTime },
    });

    logger.info(`Interview scheduled: ${interview._id} for application: ${applicationId}`);

    // Enqueue 1-hour-before reminder (non-blocking — Redis may not be available)
    if (scheduledTime) {
      const candidateUser = await User.findById(candidateId).select('firstName email phone').lean();
      const jobDoc = await Job.findById(jobId).select('title').lean();
      if (candidateUser && jobDoc) {
        // Resolve panel user emails so interviewers also receive reminders
        const panelUserIds = (panel ?? []).map((p: any) => p.userId ?? p).filter(Boolean);
        const panelUsers = panelUserIds.length > 0
          ? await User.find({ _id: { $in: panelUserIds } }).select('email firstName').lean()
          : [];
        const panelMembers = panelUsers.map((u: any) => ({ email: u.email, name: u.firstName }));

        void enqueueInterviewReminder({
          _id:          interview._id.toString(),
          scheduledTime: new Date(scheduledTime),
          candidateId:  { phone: (candidateUser as any).phone, email: (candidateUser as any).email, firstName: (candidateUser as any).firstName },
          jobId:        { title: (jobDoc as any).title },
          meetingLink:  meetingLink,
          panel:        panelMembers,
        });
      }
    }

    return sendSuccess(res, interview, 'Interview scheduled successfully', 201);
  } catch (error: any) {
    logger.error('Error in scheduleInterview:', error);
    return sendError(res, error.message || 'Error scheduling interview', 500);
  }
};

/**
 * @desc    Get all interviews (with filters)
 * @route   GET /api/v1/interviews
 * @access  Private
 */
export const getInterviews = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      page = 1,
      limit = 10,
      jobId,
      candidateId,
      status,
      from,
      to,
    } = req.query;

    const query: any = { status: { $ne: InterviewStatus.CANCELLED } };

    // Role-based filtering
    if (req.user?.role === 'candidate') {
      query.candidateId = req.user._id;
    } else if (req.user?.role === 'interviewer') {
      // Interviewers see interviews where they are panel members
      query['panel.userId'] = req.user._id;
    } else {
      // TENANT ISOLATION: All non-candidate users scoped to company
      const tenantId = getTenantCompanyId(req.user);
      if (tenantId) {
        query.companyId = tenantId;
      }
    }

    // Apply filters
    if (jobId) query.jobId = jobId;
    if (candidateId && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
      query.candidateId = candidateId;
    }
    if (status) query.status = status;
    if (from || to) {
      query.scheduledTime = {};
      if (from) query.scheduledTime.$gte = new Date(from as string);
      if (to) query.scheduledTime.$lte = new Date(to as string);
    }

    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const [interviews, total] = await Promise.all([
      Interview.find(query)
        .populate('jobId', 'title location')
        .populate('candidateId', 'firstName lastName email')
        .sort({ scheduledTime: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Interview.countDocuments(query),
    ]);

    // Add violation counts via a single batch query instead of N+1 (PERF-01 fix)
    const interviewIds = interviews
      .filter((i: any) => i.status === InterviewStatus.IN_PROGRESS || i.proctoringEnabled)
      .map((i: any) => i._id);

    let violationMap: Record<string, number> = {};
    if (interviewIds.length > 0) {
      const violationCounts = await ProctoringEvent.aggregate([
        { $match: { interviewId: { $in: interviewIds } } },
        { $group: { _id: '$interviewId', count: { $sum: 1 } } },
      ]);
      violationMap = violationCounts.reduce((acc: Record<string, number>, v: any) => {
        acc[v._id.toString()] = v.count;
        return acc;
      }, {});
    }

    const interviewsWithViolations = interviews.map((interview: any) => {
      if (interview.status === InterviewStatus.IN_PROGRESS || interview.proctoringEnabled) {
        return { ...interview, violations: violationMap[interview._id.toString()] || 0 };
      }
      return interview;
    });

    return sendPaginatedResponse(
      res,
      interviewsWithViolations,
      pageNum,
      limitNum,
      total,
      'Interviews retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getInterviews:', error);
    return sendError(res, error.message || 'Error fetching interviews', 500);
  }
};

/**
 * @desc    Get single interview by ID
 * @route   GET /api/v1/interviews/:id
 * @access  Private
 */
export const getInterviewById = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id)
      .populate('jobId')
      .populate('candidateId', '-password')
      .populate('applicationId')
      .populate('panel.userId', 'firstName lastName email');

    if (!interview || interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check — company isolation (4.6/SEC-15)
    const isCandidate = interview.candidateId._id.toString() === req.user?._id;
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId?._id.toString() === req.user?._id
    );
    const tenantId = getTenantCompanyId(req.user);
    let isCompanyMember = false;
    if (tenantId && interview.companyId) {
      isCompanyMember = interview.companyId.toString() === tenantId;
    }

    // Interviewers may only view interviews they are assigned to as panel members
    if (req.user?.role === 'interviewer' && !isPanelMember && !isCandidate) {
      return sendError(res, 'Interviewers may only view their assigned interviews', 403);
    }

    if (!isCandidate && !isCompanyMember && !isPanelMember && !isSuperAdmin(req.user)) {
      return sendError(res, 'Not authorized to view this interview', 403);
    }

    return sendSuccess(res, interview, 'Interview retrieved successfully');
  } catch (error: any) {
    logger.error('Error in getInterviewById:', error);
    return sendError(res, error.message || 'Error fetching interview', 500);
  }
};

/**
 * @desc    Update interview (reschedule, update details)
 * @route   PUT /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
export const updateInterview = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const interview = await Interview.findById(id);

    if (!interview || interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check — company isolation (4.5/SEC-15)
    const tenantId = getTenantCompanyId(req.user);
    let isCompanyMember = false;
    if (tenantId && interview.companyId) {
      isCompanyMember = interview.companyId.toString() === tenantId;
    }
    const isAuthorized = isSuperAdmin(req.user) || isCompanyMember;

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to update this interview', 403);
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
      'proctoringLevel',
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        (interview as any)[key] = updates[key];
      }
    });

    // If rescheduling, validate and update status (EC-03)
    let wasRescheduled = false;
    if (updates.scheduledTime && updates.scheduledTime !== interview.scheduledTime) {
      if (new Date(updates.scheduledTime) < new Date()) {
        return sendError(res, 'Interview cannot be rescheduled to a past date', 400);
      }
      interview.status = InterviewStatus.RESCHEDULED;
      interview.previousScheduledTime = interview.scheduledTime;
      (interview as any).rescheduleCount += 1;
      wasRescheduled = true;
    }

    await interview.save();

    // Resend notifications on reschedule (P2 gap fix)
    if (wasRescheduled) {
      const populated = await Interview.findById(id)
        .populate('jobId', 'title')
        .populate('candidateId', 'firstName lastName email');
      if (populated) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://hiring.ambiquest.com';
        const job = (populated.jobId as any);
        const candidate = (populated.candidateId as any);
        const scheduledDate = new Date(interview.scheduledTime);
        const dateStr = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (candidate?.email) {
          sendEmail({
            to: candidate.email,
            subject: `Interview Rescheduled: ${job?.title || 'Position'}`,
            template: 'interviewScheduled',
            data: {
              candidateName: `${candidate.firstName} ${candidate.lastName}`,
              jobTitle: job?.title || 'the position',
              interviewDate: dateStr,
              interviewTime: timeStr,
              interviewType: interview.round || 'Interview',
              interviewLink: interview.meetingLink || `${frontendUrl}/proctoring-check/${interview._id}`,
              proctoringCheckUrl: `${frontendUrl}/proctoring-check/${interview._id}`,
            },
          }).catch(e => logger.warn('Reschedule notification failed:', e.message));
        }
      }
    }

    logger.info(`Interview ${id} updated by ${req.user?._id}`);

    return sendSuccess(res, interview, 'Interview updated successfully');
  } catch (error: any) {
    logger.error('Error in updateInterview:', error);
    return sendError(res, error.message || 'Error updating interview', 500);
  }
};

/**
 * @desc    Update interview status
 * @route   PUT /api/v1/interviews/:id/status
 * @access  Private (Panel members, Employer/HR/Admin)
 */
export const updateInterviewStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { status, feedback, rating } = req.body;

    const interview = await Interview.findById(id);

    if (!interview || interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check — company isolation (4.5/SEC-15)
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId.toString() === req.user?._id
    );
    const tenantId = getTenantCompanyId(req.user);
    let isCompanyMember = false;
    if (tenantId && interview.companyId) {
      isCompanyMember = interview.companyId.toString() === tenantId;
    }
    // Interviewers may only update status for their assigned interviews
    if (req.user?.role === 'interviewer' && !isPanelMember) {
      return sendError(res, 'Interviewers may only update status for assigned interviews', 403);
    }

    const isAuthorized =
      isSuperAdmin(req.user) ||
      isPanelMember ||
      isCompanyMember;

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to update interview status', 403);
    }

    interview.status = status;

    // Add feedback if provided
    if (feedback) {
      (interview.feedback as any).push({
        interviewerId: req.user?._id,
        rating: rating || 0,
        comments: feedback,
        submittedAt: new Date(),
      });
    }

    await interview.save();

    // Update application status if interview is completed
    if (status === InterviewStatus.COMPLETED) {
      const application = await Application.findById(interview.applicationId);
      if (application) {
        application.status = ApplicationStatus.IN_PROGRESS;
        await application.save();
      }
    }

    logger.info(`Interview ${id} status updated to ${status}`);

    return sendSuccess(res, interview, 'Interview status updated');
  } catch (error: any) {
    logger.error('Error in updateInterviewStatus:', error);
    return sendError(res, error.message || 'Error updating interview status', 500);
  }
};

/**
 * @desc    Cancel interview
 * @route   DELETE /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
export const cancelInterview = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const interview = await Interview.findById(id);

    if (!interview || interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview cancelled already or not found', 404);
    }

    // Authorization check
    const tenantId = getTenantCompanyId(req.user);
    const isAuthorized =
      isSuperAdmin(req.user) ||
      (tenantId && interview.companyId?.toString() === tenantId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to cancel this interview', 403);
    }

    // Soft cancel — set status to CANCELLED instead of hard delete (GAP-03)
    interview.status = InterviewStatus.CANCELLED;
    if (reason) {
      interview.cancellationReason = reason;
    }
    interview.cancelledBy = req.user?._id as any;
    interview.cancelledAt = new Date();
    await interview.save();

    logger.info(`Interview ${id} cancelled by ${req.user?._id}. Reason: ${reason || 'N/A'}`);

    return sendSuccess(res, interview, 'Interview cancelled successfully');
  } catch (error: any) {
    logger.error('Error in cancelInterview:', error);
    return sendError(res, error.message || 'Error cancelling interview', 500);
  }
};

/**
 * @desc    Submit interview feedback and next round decision
 * @route   POST /api/v1/interviews/:id/feedback
 * @access  Private (Panel members, Employer/HR/Admin) OR via feedback token (?token=xxx)
 */
export const submitInterviewFeedback = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { rating, comments, recommendation, finalDecision, scores } = req.body;
    const feedbackToken = (req as any).feedbackToken as string | undefined;

    // Validation is handled by the route validator; guard here as a safety net
    if (!rating || !comments || !recommendation || !finalDecision) {
      return sendError(res, 'Rating, comments, recommendation, and final decision are required', 400);
    }

    const interview = await Interview.findById(id);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    let resolvedInterviewerId: string | undefined;

    if (feedbackToken) {
      // Token-based access — validate against panel feedbackToken
      const panelMember = (interview.panel as any[]).find(
        (m: any) => m.feedbackToken === feedbackToken
      );
      if (!panelMember) {
        return sendError(res, 'Invalid or expired feedback token', 401);
      }
      resolvedInterviewerId = panelMember.userId?.toString();
    } else {
      // JWT-based access — standard authorization
      const isPanelMember = (interview.panel as any[]).some(
        (member: any) => member.userId.toString() === req.user?._id
      );
      const tenantId = getTenantCompanyId(req.user);
      let isCompanyMember = false;
      if (tenantId && interview.companyId) {
        isCompanyMember = interview.companyId.toString() === tenantId;
      }
      // Interviewers may only submit feedback for interviews they are assigned to
      if (req.user?.role === 'interviewer' && !isPanelMember) {
        return sendError(res, 'Interviewers may only submit feedback for assigned interviews', 403);
      }
      const isAuthorized = isSuperAdmin(req.user) || isPanelMember || isCompanyMember;
      if (!isAuthorized) {
        return sendError(res, 'Not authorized to submit feedback for this interview', 403);
      }
      resolvedInterviewerId = req.user?._id;
    }

    // Add feedback (include structured scores if provided by the scorecard form)
    (interview.feedback as any).push({
      interviewerId: resolvedInterviewerId,
      rating,
      comments,
      recommendation,
      scores: scores || null,  // structured scorecard data (optional)
      submittedAt: new Date(),
    });

    // Set final decision for next round
    interview.finalDecision = finalDecision;

    // Calculate overall rating manually
    if (interview.feedback && (interview.feedback as any).length > 0) {
      const totalRating = (interview.feedback as any).reduce(
        (sum: number, fb: any) => sum + fb.rating,
        0
      );
      interview.overallRating = totalRating / (interview.feedback as any).length;
    }

    await interview.save();

    logger.info(`Feedback submitted for interview ${id} by ${resolvedInterviewerId || 'token-user'}`);

    return sendSuccess(res, interview, 'Feedback submitted successfully');
  } catch (error: any) {
    logger.error('Error in submitInterviewFeedback:', error);
    return sendError(res, error.message || 'Error submitting feedback', 500);
  }
};

/**
 * @desc    Start interview - mark as in progress and generate questions using LLM
 * @route   POST /api/v1/interviews/:id/start
 * @access  Private (Panel members, Employer/HR/Admin, Candidate)
 */
export const startInterview = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id)
      .populate('jobId')
      .populate('candidateId', '-password')
      .populate('panel.userId', 'firstName lastName email');

    if (!interview || interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check — company isolation (B-17)
    const isCandidate = interview.candidateId._id.toString() === req.user?._id;
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId?._id.toString() === req.user?._id
    );
    const tenantId = getTenantCompanyId(req.user);
    let isCompanyMember = false;
    if (tenantId && interview.companyId) {
      isCompanyMember = interview.companyId.toString() === tenantId;
    }
    // Interviewers may only start interviews they are assigned to
    if (req.user?.role === 'interviewer' && !isPanelMember && !isCandidate) {
      return sendError(res, 'Interviewers may only start their assigned interviews', 403);
    }

    const isAuthorized =
      isSuperAdmin(req.user) ||
      isPanelMember ||
      isCandidate ||
      isCompanyMember;

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to start this interview', 403);
    }

    // Check if already in progress or completed
    if (interview.status === InterviewStatus.IN_PROGRESS) {
      return sendSuccess(res, interview, 'Interview already in progress');
    }

    if (interview.status === InterviewStatus.COMPLETED) {
      return sendError(res, 'Interview already completed', 400);
    }

    // Update status to in progress
    interview.status = InterviewStatus.IN_PROGRESS;
    interview.startedAt = new Date();
    
    await interview.save();

    logger.info(`Interview ${id} started by ${req.user?._id}`);

    return sendSuccess(res, interview, 'Interview started successfully');
  } catch (error: any) {
    logger.error('Error in startInterview:', error);
    return sendError(res, error.message || 'Error starting interview', 500);
  }
};

/**
 * @desc    Get interview info for external scorecard form
 * @route   GET /api/v1/interviews/:id/feedback-info
 * @access  Private (Panel member / HR / Admin / Employer) OR via feedback token (?token=xxx)
 */
export const getInterviewFeedbackInfo = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const feedbackToken = (req as any).feedbackToken as string | undefined;

    const interview = await Interview.findById(id)
      .populate('jobId', 'title location')
      .populate('candidateId', 'firstName lastName email')
      .lean();

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    let resolvedInterviewerName = 'Interviewer';
    let resolvedInterviewerId: string | undefined;

    if (feedbackToken) {
      // Token-based access — validate against panel feedbackToken
      const panelMember = (interview.panel as any[]).find(
        (m: any) => m.feedbackToken === feedbackToken
      );
      if (!panelMember) {
        return sendError(res, 'Invalid or expired feedback token', 401);
      }
      resolvedInterviewerName = panelMember.name || 'Interviewer';
      resolvedInterviewerId = panelMember.userId?.toString();
    } else {
      // JWT-based access — standard authorization
      const tenantId = getTenantCompanyId(req.user);
      const isPanelMember = (interview.panel as any[]).some(
        (m: any) => (m.userId?.toString?.() ?? m.userId) === req.user?._id?.toString()
      );
      const isCompanyMember = tenantId
        ? interview.companyId?.toString() === tenantId
        : false;

      if (!isSuperAdmin(req.user) && !isPanelMember && !isCompanyMember) {
        return sendError(res, 'Not authorized to view this interview scorecard', 403);
      }
      resolvedInterviewerName =
        `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Interviewer';
      resolvedInterviewerId = req.user?._id?.toString();
    }

    const job = interview.jobId as any;
    const candidate = interview.candidateId as any;

    return sendSuccess(res, {
      jobTitle:         job?.title || 'N/A',
      candidateName:    candidate
        ? `${candidate.firstName} ${candidate.lastName}`
        : 'Candidate',
      interviewType:    (interview as any).round || 'Interview',
      interviewerName:  resolvedInterviewerName,
      status:           interview.status,
      scheduledTime:    interview.scheduledTime,
      existingFeedback: (interview.feedback as any[]).find(
        (fb: any) => fb.interviewerId?.toString() === resolvedInterviewerId
      ) ?? null,
    }, 'Interview info retrieved');
  } catch (error: any) {
    logger.error('Error in getInterviewFeedbackInfo:', error);
    return sendError(res, error.message || 'Error retrieving interview info', 500);
  }
};

/**
 * @desc    Notify interview parties (candidate + panel members) and generate feedback tokens
 * @route   POST /api/v1/interviews/:id/notify
 * @access  Private (Employer/HR/Admin)
 */
export const notifyInterviewParties = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id)
      .populate('jobId', 'title')
      .populate('candidateId', 'firstName lastName email')
      .populate('panel.userId', 'firstName lastName email');

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Tenant isolation
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && interview.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorized', 403);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://hiring.ambiquest.com';
    const job = interview.jobId as any;
    const candidate = interview.candidateId as any;
    const scheduledDate = new Date(interview.scheduledTime);
    const dateStr = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = scheduledDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    // Generate feedback tokens for each panel member (idempotent — don't overwrite existing)
    for (const member of interview.panel as any[]) {
      if (!member.feedbackToken) {
        member.feedbackToken = crypto.randomBytes(24).toString('hex');
      }
    }
    await interview.save();

    const errors: string[] = [];

    // ── Candidate notification ─────────────────────────────────────────────────
    if (candidate?.email) {
      try {
        await sendEmail({
          to: candidate.email,
          subject: `Interview Scheduled: ${job?.title || 'Position'}`,
          template: 'interviewScheduled',
          data: {
            candidateName: `${candidate.firstName} ${candidate.lastName}`,
            jobTitle:       job?.title || 'the position',
            interviewDate:  dateStr,
            interviewTime:  timeStr,
            interviewType:  interview.round || 'Interview',
            interviewLink:  interview.meetingLink || `${frontendUrl}/proctoring-check/${interview._id}`,
          },
        });
      } catch (e: any) {
        logger.warn(`Failed to notify candidate ${candidate.email}:`, e.message);
        errors.push(`candidate: ${e.message}`);
      }
    }

    // ── Panel member notifications ─────────────────────────────────────────────
    for (const member of interview.panel as any[]) {
      const panelEmail = (member.userId as any)?.email || member.email;
      const panelName  = (member.userId as any)?.firstName
        ? `${(member.userId as any).firstName} ${(member.userId as any).lastName}`
        : member.name || 'Interviewer';

      if (!panelEmail) continue;

      const scorecardUrl = `${frontendUrl}/interviews/${interview._id}/feedback?token=${member.feedbackToken}`;
      const candidateName = candidate
        ? `${candidate.firstName} ${candidate.lastName}`
        : 'Candidate';

      try {
        await sendEmail({
          to: panelEmail,
          subject: `Panel Interview Invite: ${job?.title || 'Position'} — ${candidateName}`,
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
                <h2 style="color: #4f46e5;">You've been added to an interview panel</h2>
                <p>Hi ${panelName},</p>
                <p>You've been assigned as a panelist for the <strong>${job?.title || 'open'}</strong> position interview with <strong>${candidateName}</strong>.</p>
                <table style="background:#f5f5f5; border-radius:8px; padding:16px; width:100%; border-collapse:collapse; margin:16px 0;">
                  <tr><td style="padding:4px 0;"><strong>Date:</strong></td><td>${dateStr}</td></tr>
                  <tr><td style="padding:4px 0;"><strong>Time:</strong></td><td>${timeStr}</td></tr>
                  <tr><td style="padding:4px 0;"><strong>Round:</strong></td><td>${interview.round || 'Interview'}</td></tr>
                  ${interview.meetingLink ? `<tr><td style="padding:4px 0;"><strong>Meeting:</strong></td><td><a href="${interview.meetingLink}">${interview.meetingLink}</a></td></tr>` : ''}
                </table>
                <p>After the interview, please submit your scorecard using the link below:</p>
                <div style="text-align:center; margin:24px 0;">
                  <a href="${scorecardUrl}" style="background:#4f46e5; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600;">
                    Submit Scorecard
                  </a>
                </div>
                <p style="color:#6b7280; font-size:12px;">This link is unique to you. Do not share it with others.</p>
              </body>
            </html>
          `,
        });
      } catch (e: any) {
        logger.warn(`Failed to notify panel member ${panelEmail}:`, e.message);
        errors.push(`panel ${panelEmail}: ${e.message}`);
      }
    }

    logger.info(`Notifications sent for interview ${id}. Errors: ${errors.length}`);

    return sendSuccess(
      res,
      { notified: true, errors: errors.length ? errors : undefined },
      errors.length
        ? `Notifications sent with ${errors.length} warning(s)`
        : 'All parties notified successfully'
    );
  } catch (error: any) {
    logger.error('Error in notifyInterviewParties:', error);
    return sendError(res, error.message || 'Error sending notifications', 500);
  }
};

/**
 * @desc    Upload a recording for a completed interview
 * @route   POST /api/v1/interviews/:id/recording
 * @access  Private (Employer/HR/Admin)
 */
export const uploadRecording = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return sendError(res, 'Recording file is required', 400);
    }

    const interview = await Interview.findById(id);
    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    const tenantId = getTenantCompanyId(req.user);
    if (!isSuperAdmin(req.user) && tenantId && interview.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorized', 403);
    }

    let recordingUrl: string;
    const bucket = (config.aws as any)?.bucket || process.env.AWS_S3_BUCKET;

    if (bucket) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AWS = require('aws-sdk') as typeof import('aws-sdk');
      const s3 = new AWS.S3({
        accessKeyId:     (config.aws as any).accessKeyId,
        secretAccessKey: (config.aws as any).secretAccessKey,
        region:          (config.aws as any).region,
      });
      const key = `recordings/${id}/${Date.now()}.webm`;
      await s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: 'video/webm',
      }).promise();
      recordingUrl = `https://${bucket}.s3.${(config.aws as any).region}.amazonaws.com/${key}`;
    } else {
      // Local filesystem fallback when S3 is not configured
      const uploadsDir = path.join(__dirname, '../../uploads/recordings', id);
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filename = `${Date.now()}.webm`;
      fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
      recordingUrl = `/uploads/recordings/${id}/${filename}`;
    }

    interview.recordingUrl = recordingUrl;
    await interview.save();

    logger.info(`[Recording] Saved for interview ${id}: ${recordingUrl}`);
    return sendSuccess(res, { recordingUrl }, 'Recording saved successfully');
  } catch (error: any) {
    logger.error('Error in uploadRecording:', error);
    return sendError(res, error.message || 'Error saving recording', 500);
  }
};
