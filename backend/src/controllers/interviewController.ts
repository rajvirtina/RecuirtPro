import { Response } from 'express';
import { Interview, Application, Job, User, InterviewTemplate, Question, ProctoringEvent } from '../models';
import { AuthRequest, InterviewStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse } from '../utils/response';
import logger from '../utils/logger';

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
      jobId,
      candidateId,
      scheduledTime,
      duration,
      mode,
      location,
      meetingLink,
      panel,
      round,
      interviewTemplateId,
    } = req.body;

    // Verify application exists
    const application = await Application.findById(applicationId);
    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        application.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to schedule interview', 403);
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
      proctoringEnabled: true, // Enable proctoring by default for online interviews
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

    logger.info(`Interview scheduled: ${interview._id} for application: ${applicationId}`);

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
    } else if (req.user?.role === 'employer' || req.user?.role === 'hr') {
      if (req.user.companyId) {
        query.companyId = req.user.companyId;
      }
    } else if (req.user?.role === 'interviewer') {
      // Interviewers see interviews where they are panel members
      query['panel.userId'] = req.user._id;
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

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
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

    // Authorization check
    const isCandidate = interview.candidateId._id.toString() === req.user?._id;
    const isEmployer = req.user?.role === 'employer' || req.user?.role === 'hr';
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId?._id.toString() === req.user?._id
    );
    const isAdmin = req.user?.role === 'admin';

    if (!isCandidate && !isEmployer && !isPanelMember && !isAdmin) {
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

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      req.user?.role === 'employer' ||
      req.user?.role === 'hr';

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
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        (interview as any)[key] = updates[key];
      }
    });

    // If rescheduling, update status
    if (updates.scheduledTime && updates.scheduledTime !== interview.scheduledTime) {
      interview.status = InterviewStatus.RESCHEDULED;
      interview.previousScheduledTime = interview.scheduledTime;
      (interview as any).rescheduleCount += 1;
    }

    await interview.save();

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

    // Authorization check
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId.toString() === req.user?._id
    );
    const isAuthorized =
      req.user?.role === 'admin' ||
      isPanelMember ||
      req.user?.role === 'employer' ||
      req.user?.role === 'hr';

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
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        interview.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to cancel this interview', 403);
    }

    interview.status = InterviewStatus.CANCELLED;
    interview.instructions = reason || 'Interview cancelled';

    await interview.save();

    logger.info(`Interview ${id} cancelled by ${req.user?._id}`);

    return sendSuccess(res, null, 'Interview cancelled successfully');
  } catch (error: any) {
    logger.error('Error in cancelInterview:', error);
    return sendError(res, error.message || 'Error cancelling interview', 500);
  }
};

/**
 * @desc    Submit interview feedback and next round decision
 * @route   POST /api/v1/interviews/:id/feedback
 * @access  Private (Panel members, Employer/HR/Admin)
 */
export const submitInterviewFeedback = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { rating, comments, recommendation, finalDecision } = req.body;

    if (!rating || !comments || !recommendation || !finalDecision) {
      return sendError(res, 'Rating, comments, recommendation, and final decision are required', 400);
    }

    const interview = await Interview.findById(id);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId.toString() === req.user?._id
    );
    const isAuthorized =
      req.user?.role === 'admin' ||
      isPanelMember ||
      req.user?.role === 'employer' ||
      req.user?.role === 'hr';

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to submit feedback for this interview', 403);
    }

    // Add feedback
    (interview.feedback as any).push({
      interviewerId: req.user?._id,
      rating,
      comments,
      recommendation,
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

    logger.info(`Feedback submitted for interview ${id} by ${req.user?._id}`);

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

    // Authorization check
    const isCandidate = interview.candidateId._id.toString() === req.user?._id;
    const isPanelMember = (interview.panel as any[]).some(
      (member: any) => member.userId?._id.toString() === req.user?._id
    );
    const isAuthorized =
      req.user?.role === 'admin' ||
      isPanelMember ||
      isCandidate ||
      req.user?.role === 'employer' ||
      req.user?.role === 'hr';

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
