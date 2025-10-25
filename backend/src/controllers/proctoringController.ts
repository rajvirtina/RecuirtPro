import { Response } from 'express';
import { ProctoringEvent, Interview } from '../models';
import { AuthRequest, ProctoringEventType, InterviewStatus } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import { emitViolation, emitInterviewTermination, emitWarning } from '../socket/socketController';

/**
 * @desc    Verify system readiness for proctored interview
 * @route   POST /api/v1/proctoring/verify/:interviewId
 * @access  Public (Candidate with interview link)
 */
export const verifySystemReadiness = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId } = req.params;
    const {
      webcamEnabled,
      microphoneEnabled,
      remoteAppsDetected,
      runningApplications,
      browserInfo,
      deviceInfo,
      ipAddress,
    } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    if (interview.status === InterviewStatus.CANCELLED) {
      return sendError(res, 'Interview has been cancelled', 400);
    }

    // Check for violations
    const violations: string[] = [];
    const events: any[] = [];

    // Check webcam
    if (!webcamEnabled) {
      violations.push('Webcam not enabled or not detected');
      events.push({
        interviewId,
        candidateId: interview.candidateId,
        eventType: ProctoringEventType.NO_FACE_DETECTED,
        severity: 'critical',
        description: 'Webcam not enabled during system check',
        metadata: { deviceInfo, browserInfo },
      });
    }

    // Check microphone
    if (!microphoneEnabled) {
      violations.push('Microphone not enabled or not detected');
      events.push({
        interviewId,
        candidateId: interview.candidateId,
        eventType: ProctoringEventType.AUDIO_ISSUE,
        severity: 'high',
        description: 'Microphone not enabled during system check',
        metadata: { deviceInfo, browserInfo },
      });
    }

    // Check for remote sharing apps
    const forbiddenApps = [
      'teamviewer',
      'anydesk',
      'ultraviewer',
      'uvnc',
      'tightvnc',
      'realvnc',
      'chrome remote desktop',
      'remote desktop',
      'vnc',
      'ammyy',
      'logmein',
      'gotomypc',
      'join.me',
      'zoho assist',
      'supremo',
      'bomgar',
      'splashtop',
      'dameware',
      'beyondtrust',
      'connectwise',
      'screenconnect',
      'remoteutilities',
      'remotepc',
      'mikogo',
      'showmypc',
      'crossloop',
    ];

    if (remoteAppsDetected && Array.isArray(remoteAppsDetected)) {
      const detectedForbidden = remoteAppsDetected.filter((app: string) =>
        forbiddenApps.some((forbidden) => app.toLowerCase().includes(forbidden))
      );

      if (detectedForbidden.length > 0) {
        violations.push(
          `Remote sharing applications detected: ${detectedForbidden.join(', ')}`
        );
        events.push({
          interviewId,
          candidateId: interview.candidateId,
          eventType: ProctoringEventType.UNAUTHORIZED_APP,
          severity: 'critical',
          description: `Remote sharing apps detected: ${detectedForbidden.join(', ')}`,
          metadata: {
            applications: detectedForbidden,
            allRunningApps: runningApplications,
            browserInfo,
            deviceInfo,
            ipAddress,
          },
        });
      }
    }

    // Additional check for running applications list
    if (runningApplications && Array.isArray(runningApplications)) {
      const suspiciousProcesses = runningApplications.filter((app: string) =>
        forbiddenApps.some((forbidden) => app.toLowerCase().includes(forbidden))
      );

      if (suspiciousProcesses.length > 0) {
        violations.push(
          `Prohibited processes detected on your system: ${suspiciousProcesses.join(', ')}. Please close these applications.`
        );
      }
    }

    // Log system check event
    await ProctoringEvent.create({
      interviewId,
      candidateId: interview.candidateId,
      eventType: ProctoringEventType.INTERVIEW_STARTED,
      severity: violations.length > 0 ? 'critical' : 'low',
      description: `System check ${violations.length > 0 ? 'failed' : 'passed'}`,
      metadata: {
        webcamEnabled,
        microphoneEnabled,
        remoteAppsDetected,
        runningApplications,
        browserInfo,
        deviceInfo,
        ipAddress,
        violations,
      },
    });

    // Create events for violations
    if (events.length > 0) {
      await ProctoringEvent.insertMany(events);
    }

    // Update interview with system check status
    interview.metadata = {
      ...interview.metadata,
      systemCheckCompleted: true,
      systemCheckTimestamp: new Date(),
      systemCheckPassed: violations.length === 0,
      systemCheckViolations: violations,
    };
    await interview.save();

    if (violations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'System check failed. Please fix the issues and try again.',
        errors: violations,
        data: { canProceed: false },
      });
    }

    logger.info(`System check passed for interview ${interviewId}`);

    return sendSuccess(
      res,
      {
        verified: true,
        interviewId,
        message: 'System check passed. You can now join the interview.',
      },
      'System verification successful'
    );
  } catch (error: any) {
    logger.error('Error in verifySystemReadiness:', error);
    return sendError(res, error.message || 'Error verifying system readiness', 500);
  }
};

/**
 * @desc    Log proctoring event during interview
 * @route   POST /api/v1/proctoring/event
 * @access  Public (During active interview)
 */
export const logProctoringEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      interviewId,
      eventType,
      severity,
      description,
      snapshotUrl,
      metadata,
    } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    const event = await ProctoringEvent.create({
      interviewId,
      candidateId: interview.candidateId,
      eventType,
      severity: severity || 'medium',
      description,
      snapshotUrl,
      metadata,
    });

    logger.warn(
      `Proctoring event logged: ${eventType} for interview ${interviewId} - Severity: ${severity}`
    );

    return sendSuccess(res, event, 'Event logged', 201);
  } catch (error: any) {
    logger.error('Error in logProctoringEvent:', error);
    return sendError(res, error.message || 'Error logging proctoring event', 500);
  }
};

/**
 * @desc    Get proctoring events for an interview
 * @route   GET /api/v1/proctoring/events/:interviewId
 * @access  Private (Employer/HR/Admin)
 */
export const getProctoringEvents = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        interview.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to view proctoring events', 403);
    }

    const events = await ProctoringEvent.find({ interviewId })
      .sort({ timestamp: -1 })
      .populate('reviewedBy', 'firstName lastName');

    const summary = {
      totalEvents: events.length,
      criticalEvents: events.filter((e) => e.severity === 'critical').length,
      highSeverity: events.filter((e) => e.severity === 'high').length,
      mediumSeverity: events.filter((e) => e.severity === 'medium').length,
      lowSeverity: events.filter((e) => e.severity === 'low').length,
      reviewed: events.filter((e) => e.reviewed).length,
      unreviewed: events.filter((e) => !e.reviewed).length,
    };

    return sendSuccess(
      res,
      { events, summary },
      'Proctoring events retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getProctoringEvents:', error);
    return sendError(res, error.message || 'Error fetching proctoring events', 500);
  }
};

/**
 * @desc    Review proctoring event
 * @route   PUT /api/v1/proctoring/event/:id/review
 * @access  Private (Employer/HR/Admin)
 */
export const reviewProctoringEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { reviewComments } = req.body;

    const event = await ProctoringEvent.findById(id).populate({
      path: 'interviewId',
      select: 'companyId',
    });

    if (!event) {
      return sendError(res, 'Event not found', 404);
    }

    const interview = event.interviewId as any;

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        interview.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to review this event', 403);
    }

    event.reviewed = true;
    event.reviewedBy = req.user?._id as any;
    event.reviewedAt = new Date();
    event.reviewComments = reviewComments;

    await event.save();

    logger.info(`Proctoring event ${id} reviewed by ${req.user?._id}`);

    return sendSuccess(res, event, 'Event reviewed successfully');
  } catch (error: any) {
    logger.error('Error in reviewProctoringEvent:', error);
    return sendError(res, error.message || 'Error reviewing event', 500);
  }
};

/**
 * @desc    Get system check status for an interview
 * @route   GET /api/v1/proctoring/system-check/:interviewId
 * @access  Public (Candidate with interview link)
 */
export const getSystemCheckStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    const systemCheckData = {
      interviewId,
      scheduledTime: interview.scheduledTime,
      systemCheckCompleted: interview.metadata?.systemCheckCompleted || false,
      systemCheckPassed: interview.metadata?.systemCheckPassed || false,
      systemCheckTimestamp: interview.metadata?.systemCheckTimestamp,
      violations: interview.metadata?.systemCheckViolations || [],
      canJoinInterview:
        interview.metadata?.systemCheckPassed &&
        new Date() >= new Date(interview.scheduledTime),
    };

    return sendSuccess(res, systemCheckData, 'System check status retrieved');
  } catch (error: any) {
    logger.error('Error in getSystemCheckStatus:', error);
    return sendError(res, error.message || 'Error getting system check status', 500);
  }
};

/**
 * @desc    Report desktop app proctoring event
 * @route   POST /api/v1/proctoring/desktop-event
 * @access  Private (Desktop app with auth token)
 */
export const reportDesktopEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      interviewId,
      eventType,
      timestamp,
      metadata,
    } = req.body;

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Map desktop event types to proctoring event types
    const eventTypeMap: Record<string, ProctoringEventType> = {
      'PROHIBITED_PROCESS_DETECTED': ProctoringEventType.UNAUTHORIZED_APP,
      'MULTIPLE_CHROME_INSTANCES': ProctoringEventType.MULTIPLE_BROWSER_TABS,
      'MULTIPLE_DISPLAYS': ProctoringEventType.MULTIPLE_DISPLAYS,
      'WINDOW_FOCUS_LOST': ProctoringEventType.TAB_SWITCH,
      'EXCESSIVE_CPU_USAGE': ProctoringEventType.SYSTEM_RESOURCE_ISSUE,
      'MEMORY_THRESHOLD_EXCEEDED': ProctoringEventType.SYSTEM_RESOURCE_ISSUE,
    };

    const mappedEventType = eventTypeMap[eventType] || ProctoringEventType.SUSPICIOUS_BEHAVIOR;
    const severity = metadata?.severity || 'medium';

    // Create proctoring event
    const event = await ProctoringEvent.create({
      interviewId,
      candidateId: interview.candidateId,
      eventType: mappedEventType,
      severity,
      description: metadata?.details || `Desktop app reported: ${eventType}`,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: {
        ...metadata,
        sourceType: 'desktop-app',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        originalEventType: eventType,
      },
    });

    logger.info('Desktop proctoring event reported', {
      interviewId,
      eventType,
      severity,
    });

    // Handle critical violations
    if (severity === 'critical') {
      // Track violations in interview metadata
      const currentViolations = (interview.metadata?.criticalViolations || 0) + 1;
      interview.metadata = {
        ...interview.metadata,
        criticalViolations: currentViolations,
        lastViolationTimestamp: new Date(),
      };

      // Auto-terminate after 3 critical violations
      if (currentViolations >= 3) {
        interview.status = InterviewStatus.CANCELLED;
        interview.metadata.terminationReason = 'Multiple critical violations detected';
        interview.metadata.terminatedAt = new Date();
        await interview.save();

        logger.warn('Interview terminated due to violations', {
          interviewId,
          violations: currentViolations,
        });

        // Emit termination via WebSocket
        emitInterviewTermination(
          interviewId.toString(),
          'Multiple critical violations detected'
        );

        return sendSuccess(res, {
          event,
          action: 'INTERVIEW_TERMINATED',
          message: 'Interview has been terminated due to multiple critical violations',
          terminationReason: 'Multiple critical violations detected',
        });
      }

      await interview.save();

      // Emit warning via WebSocket
      emitWarning(
        interviewId.toString(),
        `Critical violation detected. ${3 - currentViolations} warnings remaining.`,
        3 - currentViolations
      );

      return sendSuccess(res, {
        event,
        action: 'WARNING',
        message: `Critical violation recorded. ${3 - currentViolations} warnings remaining before termination.`,
        warningsRemaining: 3 - currentViolations,
      });
    }

    // Emit violation to HR dashboard via WebSocket
    emitViolation(interviewId.toString(), event);

    return sendSuccess(res, { event });
  } catch (error: any) {
    logger.error('Error reporting desktop event:', error);
    return sendError(res, error.message || 'Error reporting desktop event', 500);
  }
};

/**
 * @desc    Desktop app heartbeat
 * @route   POST /api/v1/proctoring/heartbeat
 * @access  Private (Desktop app with auth token)
 */
export const sendHeartbeat = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId, status } = req.body;

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Log heartbeat event (low severity, won't clutter event log)
    await ProctoringEvent.create({
      interviewId,
      candidateId: interview.candidateId,
      eventType: ProctoringEventType.SESSION_ACTIVE,
      severity: 'low',
      description: 'Desktop app heartbeat',
      metadata: {
        status,
        ipAddress: req.ip,
        sourceType: 'desktop-app',
      },
    });

    // Check if interview has been terminated
    if (interview.status === InterviewStatus.CANCELLED) {
      return res.json({
        success: true,
        action: 'TERMINATE',
        message: interview.metadata?.terminationReason || 'Interview has been terminated',
        interviewStatus: interview.status,
      });
    }

    return sendSuccess(res, {
      interviewStatus: interview.status,
      criticalViolations: interview.metadata?.criticalViolations || 0,
      maxViolations: 3,
    });
  } catch (error: any) {
    logger.error('Error processing heartbeat:', error);
    return sendError(res, error.message || 'Error processing heartbeat', 500);
  }
};

/**
 * @desc    Get interview status for desktop app
 * @route   GET /api/v1/proctoring/interview-status/:interviewId
 * @access  Private (Desktop app with auth token)
 */
export const getInterviewStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId)
      .select('status scheduledTime duration metadata candidateId companyId')
      .lean();

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    return sendSuccess(res, {
      interviewId,
      status: interview.status,
      scheduledTime: interview.scheduledTime,
      duration: interview.duration,
      criticalViolations: interview.metadata?.criticalViolations || 0,
      isTerminated: interview.status === InterviewStatus.CANCELLED,
      terminationReason: interview.metadata?.terminationReason,
    });
  } catch (error: any) {
    logger.error('Error getting interview status:', error);
    return sendError(res, error.message || 'Error getting interview status', 500);
  }
};

/**
 * @desc    Get recent proctoring events (for HR dashboard)
 * @route   GET /api/v1/proctoring/events/recent
 * @access  Private (HR/Admin)
 */
export const getRecentProctoringEvents = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const companyId = req.user?.companyId;

    // Build query based on user role
    let query: any = {};
    
    if (req.user?.role !== 'admin') {
      // HR users only see events from their company's interviews
      const interviews = await Interview.find({ companyId }).select('_id');
      const interviewIds = interviews.map((i) => i._id);
      query.interviewId = { $in: interviewIds };
    }

    const events = await ProctoringEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('interviewId', 'candidateId scheduledTime status')
      .populate({
        path: 'interviewId',
        populate: {
          path: 'candidateId',
          select: 'firstName lastName email',
        },
      })
      .lean();

    return sendSuccess(res, events, 'Recent proctoring events retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting recent proctoring events:', error);
    return sendError(res, error.message || 'Error fetching recent events', 500);
  }
};
