import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProctoringEvent, Interview } from '../models';
import { AIInterviewSession } from '../models/AIInterviewSession';
import ConsentLog from '../models/ConsentLog';
import { User } from '../models';
import { AuthRequest, ProctoringEventType, InterviewStatus } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import { emitViolation, emitInterviewTermination, emitWarning } from '../socket/socketController';
import { notificationService } from '../services/notificationService';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';

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

    // Authorization check — tenant isolation (NEW-05)
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && interview.companyId?.toString() !== tenantId) {
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

    // Authorization check — tenant isolation (NEW-05)
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && interview.companyId?.toString() !== tenantId) {
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

    // Handle critical/high violations — notify HR in-app + real-time
    if (severity === 'critical' || severity === 'high') {
      // Gather HR users for this company (fire-and-forget)
      const notifyHR = async () => {
        try {
          const hrUsers = await User.find({
            companyId: (interview as any).companyId,
            role: { $in: ['hr', 'employer', 'admin'] },
            isActive: true,
          }).select('_id').lean();
          const hrIds = hrUsers.map((u: any) => u._id.toString());
          if (hrIds.length === 0) return;

          const candidate = await User.findById(interview.candidateId).select('firstName lastName').lean();
          const candName = candidate
            ? `${(candidate as any).firstName} ${(candidate as any).lastName}`.trim()
            : 'Candidate';

          await notificationService.notifyProctoringViolation(
            hrIds,
            candName,
            eventType,
            severity as 'high' | 'critical',
            interviewId.toString()
          );
        } catch (e: any) {
          logger.warn(`Proctoring HR notification failed: ${e.message}`);
        }
      };
      void notifyHR();
    }

    // Handle critical violations (auto-terminate logic)
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

// PERF-04: In-memory heartbeat tracking to avoid DB write per interval
const heartbeatCache = new Map<string, { candidateId: any; lastSeen: number; count: number }>();
const HEARTBEAT_FLUSH_INTERVAL = 60_000; // Flush to DB every 60 seconds

// Periodically flush heartbeat summaries to DB
setInterval(async () => {
  const now = Date.now();
  const staleThreshold = 2 * 60_000; // 2 minutes
  const toFlush: Array<{ interviewId: string; candidateId: any; count: number; lastSeen: number }> = [];

  for (const [interviewId, data] of heartbeatCache.entries()) {
    toFlush.push({ interviewId, ...data });
    // Remove stale entries
    if (now - data.lastSeen > staleThreshold) {
      heartbeatCache.delete(interviewId);
    } else {
      // Reset counter after flush
      data.count = 0;
    }
  }

  if (toFlush.length > 0) {
    try {
      const docs = toFlush.map((h) => ({
        interviewId: h.interviewId,
        candidateId: h.candidateId,
        eventType: ProctoringEventType.SESSION_ACTIVE,
        severity: 'low' as const,
        description: `Heartbeat summary: ${h.count} beats in last interval`,
        metadata: { heartbeatCount: h.count, sourceType: 'desktop-app' },
      }));
      await ProctoringEvent.insertMany(docs);
    } catch (err) {
      logger.error('Error flushing heartbeat cache:', err);
    }
  }
}, HEARTBEAT_FLUSH_INTERVAL);

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

    // PERF-04: Track heartbeat in memory instead of writing to DB every interval
    const existing = heartbeatCache.get(interviewId);
    if (existing) {
      existing.lastSeen = Date.now();
      existing.count += 1;
    } else {
      heartbeatCache.set(interviewId, {
        candidateId: interview.candidateId,
        lastSeen: Date.now(),
        count: 1,
      });
    }

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

// ─── Session-based proctoring (AI interview public flow) ─────────────────────

/** Violation-type → ProctoringEventType mapping */
const SESSION_VIOLATION_MAP: Record<string, ProctoringEventType> = {
  tab_switch:     ProctoringEventType.TAB_SWITCH,
  window_blur:    ProctoringEventType.WINDOW_BLUR,
  multiple_faces: ProctoringEventType.MULTIPLE_FACES,
  no_face:        ProctoringEventType.NO_FACE_DETECTED,
  copy_attempt:   ProctoringEventType.SUSPICIOUS_BEHAVIOR,
};

const SESSION_VIOLATION_DESC: Record<string, string> = {
  tab_switch:     'Candidate switched or minimised the interview tab',
  window_blur:    'Interview window lost focus for more than 3 seconds',
  multiple_faces: 'Multiple faces detected in webcam feed',
  no_face:        'No face detected in webcam feed',
  copy_attempt:   'Candidate attempted to copy text from the interview',
};

/** Resolve and validate an AIInterviewSession by its public token */
async function resolveSessionOrFail(sessionId: string, res: Response) {
  const session = await AIInterviewSession.findOne({ sessionId }).lean();
  if (!session) {
    sendError(res, 'Session not found or expired', 404);
    return null;
  }
  if (session.status === 'expired' || new Date() > session.expiresAt) {
    await AIInterviewSession.updateOne({ sessionId }, { status: 'expired' });
    sendError(res, 'Session has expired', 410);
    return null;
  }
  return session;
}

/**
 * @desc  Record candidate proctoring consent for an AI interview session
 * @route POST /api/v1/proctoring/session/:sessionId/consent
 * @auth  None (session token is the credential)
 */
export const recordConsent = async (
  req: Request,
  res: Response
): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const { consented, timestamp, userAgent } = req.body;

    const session = await resolveSessionOrFail(sessionId, res);
    if (!session) return;

    // Fetch candidate info for the consent log
    const candidate = await User.findById(session.candidateId)
      .select('email firstName lastName')
      .lean();

    await ConsentLog.create({
      userId:         session.candidateId,
      userEmail:      candidate?.email ?? 'unknown',
      userName:       candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Candidate',
      consentType:    'monitoring',
      consentVersion: '1.0',
      granted:        Boolean(consented),
      timestamp:      timestamp ? new Date(timestamp) : new Date(),
      userAgent:      userAgent ?? (req.headers['user-agent'] ?? ''),
      interviewId:    session.interviewId,
      companyId:      session.companyId,
    });

    // Mark consent on the session
    await AIInterviewSession.updateOne(
      { sessionId },
      { consentGiven: Boolean(consented), consentGivenAt: new Date() }
    );

    // Log a proctoring event so HR can see consent was captured
    await ProctoringEvent.create({
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      eventType:   consented ? ProctoringEventType.CONSENT_GIVEN : ProctoringEventType.CONSENT_DENIED,
      severity:    'low',
      description: consented
        ? 'Candidate granted proctoring consent'
        : 'Candidate declined proctoring consent',
      timestamp:   new Date(),
    });

    return sendSuccess(res, { consented }, 'Consent recorded');
  } catch (error: any) {
    logger.error('recordConsent error:', error);
    return sendError(res, error.message || 'Failed to record consent', 500);
  }
};

/**
 * @desc  Log a real-time violation during an AI interview session
 * @route POST /api/v1/proctoring/session/:sessionId/violation
 * @auth  None (session token is the credential)
 */
export const logSessionViolation = async (
  req: Request,
  res: Response
): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const { type, severity, timestamp, screenshotBase64 } = req.body;

    const session = await resolveSessionOrFail(sessionId, res);
    if (!session) return;

    const eventType = SESSION_VIOLATION_MAP[type] ?? ProctoringEventType.VIOLATION;
    const description = SESSION_VIOLATION_DESC[type] ?? `Proctoring violation: ${type}`;

    const event = await ProctoringEvent.create({
      interviewId:  session.interviewId,
      candidateId:  session.candidateId,
      eventType,
      severity:     severity ?? 'medium',
      description,
      timestamp:    timestamp ? new Date(timestamp) : new Date(),
      // Store small webcam frames (face violations) as data URLs; skip if too large
      snapshotUrl:  screenshotBase64 && screenshotBase64.length < 150_000
        ? screenshotBase64
        : undefined,
      metadata: {
        source:    'ai_interview_browser',
        sessionId,
        violationType: type,
      },
      reviewed: false,
    });

    // Emit to HR dashboard in real-time
    emitViolation(session.interviewId.toString(), event);

    return sendSuccess(res, { logged: true, eventId: event._id }, 'Violation logged');
  } catch (error: any) {
    logger.error('logSessionViolation error:', error);
    return sendError(res, 'Failed to log violation', 500);
  }
};

/**
 * @desc  Structured proctoring report for an application (used by ApplicationDetail Proctoring tab)
 * @route GET /api/v1/proctoring/application/:applicationId/report
 * @auth  HR / Admin / Employer
 */
export const getProctoringReportByApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { applicationId } = req.params;
    const tenantId = req.user?.companyId;

    // Find the interview(s) linked to this application
    const interview = await Interview.findOne({ applicationId })
      .select('_id companyId proctoringEnabled status scheduledTime duration candidateId')
      .lean();

    if (!interview) {
      return sendSuccess(res, { hasData: false, events: [], summary: null }, 'No interview found for this application');
    }

    // Tenant isolation
    if (tenantId && interview.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorised to view this report', 403);
    }

    // Fetch all proctoring events for the interview, sorted by time
    const events = await ProctoringEvent.find({ interviewId: interview._id })
      .sort({ timestamp: 1 })
      .lean();

    // System / informational events that should NOT count as violations
    const SYSTEM_EVENT_TYPES = new Set([
      'consent_given', 'consent_denied', 'interview_started', 'interview_ended',
      'system_check_passed', 'screenshot_captured',
    ]);

    // Violations are non-system events only
    const violationEvents = events.filter(e => !SYSTEM_EVENT_TYPES.has(e.eventType));

    const total = violationEvents.length;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      total >= 6 ? 'HIGH' : total >= 3 ? 'MEDIUM' : 'LOW';

    const bySeverity = {
      critical: violationEvents.filter(e => e.severity === 'critical').length,
      high:     violationEvents.filter(e => e.severity === 'high').length,
      medium:   violationEvents.filter(e => e.severity === 'medium').length,
      low:      violationEvents.filter(e => e.severity === 'low').length,
    };

    const byType: Record<string, number> = {};
    violationEvents.forEach(e => { byType[e.eventType] = (byType[e.eventType] ?? 0) + 1; });

    const reviewed = violationEvents.filter(e => e.reviewed).length;

    const assessment =
      total >= 6
        ? 'Multiple violations detected — manual review is strongly recommended before advancing this candidate.'
        : total >= 3
        ? 'Some violations detected — a brief review is recommended.'
        : total > 0
        ? 'Minor monitoring events recorded — no immediate concerns.'
        : 'No proctoring violations recorded. Session completed cleanly.';

    return sendSuccess(res, {
      hasData:      total > 0 || events.length > 0,
      riskLevel,
      interviewId:  interview._id,
      proctoringEnabled: interview.proctoringEnabled,
      summary: {
        total,
        reviewed,
        unreviewed: total - reviewed,
        bySeverity,
        byType,
      },
      assessment,
      // Return all events (including system events) so the UI can render the full timeline
      // but only violation events count toward the summary totals
      events,
      violationCount: total,
    }, 'Proctoring report retrieved');
  } catch (error: any) {
    logger.error('getProctoringReportByApplication error:', error);
    return sendError(res, error.message || 'Failed to retrieve proctoring report', 500);
  }
};
