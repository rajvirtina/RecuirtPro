"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentProctoringEvents = exports.getInterviewStatus = exports.sendHeartbeat = exports.reportDesktopEvent = exports.getSystemCheckStatus = exports.reviewProctoringEvent = exports.getProctoringEvents = exports.logProctoringEvent = exports.verifySystemReadiness = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const socketController_1 = require("../socket/socketController");
const auth_1 = require("../middleware/auth");
/**
 * @desc    Verify system readiness for proctored interview
 * @route   POST /api/v1/proctoring/verify/:interviewId
 * @access  Public (Candidate with interview link)
 */
const verifySystemReadiness = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const { webcamEnabled, microphoneEnabled, remoteAppsDetected, runningApplications, browserInfo, deviceInfo, ipAddress, } = req.body;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        if (interview.status === types_1.InterviewStatus.CANCELLED) {
            return (0, response_1.sendError)(res, 'Interview has been cancelled', 400);
        }
        // Check for violations
        const violations = [];
        const events = [];
        // Check webcam
        if (!webcamEnabled) {
            violations.push('Webcam not enabled or not detected');
            events.push({
                interviewId,
                candidateId: interview.candidateId,
                eventType: types_1.ProctoringEventType.NO_FACE_DETECTED,
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
                eventType: types_1.ProctoringEventType.AUDIO_ISSUE,
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
            const detectedForbidden = remoteAppsDetected.filter((app) => forbiddenApps.some((forbidden) => app.toLowerCase().includes(forbidden)));
            if (detectedForbidden.length > 0) {
                violations.push(`Remote sharing applications detected: ${detectedForbidden.join(', ')}`);
                events.push({
                    interviewId,
                    candidateId: interview.candidateId,
                    eventType: types_1.ProctoringEventType.UNAUTHORIZED_APP,
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
            const suspiciousProcesses = runningApplications.filter((app) => forbiddenApps.some((forbidden) => app.toLowerCase().includes(forbidden)));
            if (suspiciousProcesses.length > 0) {
                violations.push(`Prohibited processes detected on your system: ${suspiciousProcesses.join(', ')}. Please close these applications.`);
            }
        }
        // Log system check event
        await models_1.ProctoringEvent.create({
            interviewId,
            candidateId: interview.candidateId,
            eventType: types_1.ProctoringEventType.INTERVIEW_STARTED,
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
            await models_1.ProctoringEvent.insertMany(events);
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
        logger_1.default.info(`System check passed for interview ${interviewId}`);
        return (0, response_1.sendSuccess)(res, {
            verified: true,
            interviewId,
            message: 'System check passed. You can now join the interview.',
        }, 'System verification successful');
    }
    catch (error) {
        logger_1.default.error('Error in verifySystemReadiness:', error);
        return (0, response_1.sendError)(res, error.message || 'Error verifying system readiness', 500);
    }
};
exports.verifySystemReadiness = verifySystemReadiness;
/**
 * @desc    Log proctoring event during interview
 * @route   POST /api/v1/proctoring/event
 * @access  Public (During active interview)
 */
const logProctoringEvent = async (req, res) => {
    try {
        const { interviewId, eventType, severity, description, snapshotUrl, metadata, } = req.body;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        const event = await models_1.ProctoringEvent.create({
            interviewId,
            candidateId: interview.candidateId,
            eventType,
            severity: severity || 'medium',
            description,
            snapshotUrl,
            metadata,
        });
        logger_1.default.warn(`Proctoring event logged: ${eventType} for interview ${interviewId} - Severity: ${severity}`);
        return (0, response_1.sendSuccess)(res, event, 'Event logged', 201);
    }
    catch (error) {
        logger_1.default.error('Error in logProctoringEvent:', error);
        return (0, response_1.sendError)(res, error.message || 'Error logging proctoring event', 500);
    }
};
exports.logProctoringEvent = logProctoringEvent;
/**
 * @desc    Get proctoring events for an interview
 * @route   GET /api/v1/proctoring/events/:interviewId
 * @access  Private (Employer/HR/Admin)
 */
const getProctoringEvents = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Authorization check — tenant isolation (NEW-05)
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && interview.companyId?.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorized to view proctoring events', 403);
        }
        const events = await models_1.ProctoringEvent.find({ interviewId })
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
        return (0, response_1.sendSuccess)(res, { events, summary }, 'Proctoring events retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getProctoringEvents:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching proctoring events', 500);
    }
};
exports.getProctoringEvents = getProctoringEvents;
/**
 * @desc    Review proctoring event
 * @route   PUT /api/v1/proctoring/event/:id/review
 * @access  Private (Employer/HR/Admin)
 */
const reviewProctoringEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewComments } = req.body;
        const event = await models_1.ProctoringEvent.findById(id).populate({
            path: 'interviewId',
            select: 'companyId',
        });
        if (!event) {
            return (0, response_1.sendError)(res, 'Event not found', 404);
        }
        const interview = event.interviewId;
        // Authorization check — tenant isolation (NEW-05)
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && interview.companyId?.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorized to review this event', 403);
        }
        event.reviewed = true;
        event.reviewedBy = req.user?._id;
        event.reviewedAt = new Date();
        event.reviewComments = reviewComments;
        await event.save();
        logger_1.default.info(`Proctoring event ${id} reviewed by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, event, 'Event reviewed successfully');
    }
    catch (error) {
        logger_1.default.error('Error in reviewProctoringEvent:', error);
        return (0, response_1.sendError)(res, error.message || 'Error reviewing event', 500);
    }
};
exports.reviewProctoringEvent = reviewProctoringEvent;
/**
 * @desc    Get system check status for an interview
 * @route   GET /api/v1/proctoring/system-check/:interviewId
 * @access  Public (Candidate with interview link)
 */
const getSystemCheckStatus = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        const systemCheckData = {
            interviewId,
            scheduledTime: interview.scheduledTime,
            systemCheckCompleted: interview.metadata?.systemCheckCompleted || false,
            systemCheckPassed: interview.metadata?.systemCheckPassed || false,
            systemCheckTimestamp: interview.metadata?.systemCheckTimestamp,
            violations: interview.metadata?.systemCheckViolations || [],
            canJoinInterview: interview.metadata?.systemCheckPassed &&
                new Date() >= new Date(interview.scheduledTime),
        };
        return (0, response_1.sendSuccess)(res, systemCheckData, 'System check status retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getSystemCheckStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Error getting system check status', 500);
    }
};
exports.getSystemCheckStatus = getSystemCheckStatus;
/**
 * @desc    Report desktop app proctoring event
 * @route   POST /api/v1/proctoring/desktop-event
 * @access  Private (Desktop app with auth token)
 */
const reportDesktopEvent = async (req, res) => {
    try {
        const { interviewId, eventType, timestamp, metadata, } = req.body;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Map desktop event types to proctoring event types
        const eventTypeMap = {
            'PROHIBITED_PROCESS_DETECTED': types_1.ProctoringEventType.UNAUTHORIZED_APP,
            'MULTIPLE_CHROME_INSTANCES': types_1.ProctoringEventType.MULTIPLE_BROWSER_TABS,
            'MULTIPLE_DISPLAYS': types_1.ProctoringEventType.MULTIPLE_DISPLAYS,
            'WINDOW_FOCUS_LOST': types_1.ProctoringEventType.TAB_SWITCH,
            'EXCESSIVE_CPU_USAGE': types_1.ProctoringEventType.SYSTEM_RESOURCE_ISSUE,
            'MEMORY_THRESHOLD_EXCEEDED': types_1.ProctoringEventType.SYSTEM_RESOURCE_ISSUE,
        };
        const mappedEventType = eventTypeMap[eventType] || types_1.ProctoringEventType.SUSPICIOUS_BEHAVIOR;
        const severity = metadata?.severity || 'medium';
        // Create proctoring event
        const event = await models_1.ProctoringEvent.create({
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
        logger_1.default.info('Desktop proctoring event reported', {
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
                interview.status = types_1.InterviewStatus.CANCELLED;
                interview.metadata.terminationReason = 'Multiple critical violations detected';
                interview.metadata.terminatedAt = new Date();
                await interview.save();
                logger_1.default.warn('Interview terminated due to violations', {
                    interviewId,
                    violations: currentViolations,
                });
                // Emit termination via WebSocket
                (0, socketController_1.emitInterviewTermination)(interviewId.toString(), 'Multiple critical violations detected');
                return (0, response_1.sendSuccess)(res, {
                    event,
                    action: 'INTERVIEW_TERMINATED',
                    message: 'Interview has been terminated due to multiple critical violations',
                    terminationReason: 'Multiple critical violations detected',
                });
            }
            await interview.save();
            // Emit warning via WebSocket
            (0, socketController_1.emitWarning)(interviewId.toString(), `Critical violation detected. ${3 - currentViolations} warnings remaining.`, 3 - currentViolations);
            return (0, response_1.sendSuccess)(res, {
                event,
                action: 'WARNING',
                message: `Critical violation recorded. ${3 - currentViolations} warnings remaining before termination.`,
                warningsRemaining: 3 - currentViolations,
            });
        }
        // Emit violation to HR dashboard via WebSocket
        (0, socketController_1.emitViolation)(interviewId.toString(), event);
        return (0, response_1.sendSuccess)(res, { event });
    }
    catch (error) {
        logger_1.default.error('Error reporting desktop event:', error);
        return (0, response_1.sendError)(res, error.message || 'Error reporting desktop event', 500);
    }
};
exports.reportDesktopEvent = reportDesktopEvent;
// PERF-04: In-memory heartbeat tracking to avoid DB write per interval
const heartbeatCache = new Map();
const HEARTBEAT_FLUSH_INTERVAL = 60000; // Flush to DB every 60 seconds
// Periodically flush heartbeat summaries to DB
setInterval(async () => {
    const now = Date.now();
    const staleThreshold = 2 * 60000; // 2 minutes
    const toFlush = [];
    for (const [interviewId, data] of heartbeatCache.entries()) {
        toFlush.push({ interviewId, ...data });
        // Remove stale entries
        if (now - data.lastSeen > staleThreshold) {
            heartbeatCache.delete(interviewId);
        }
        else {
            // Reset counter after flush
            data.count = 0;
        }
    }
    if (toFlush.length > 0) {
        try {
            const docs = toFlush.map((h) => ({
                interviewId: h.interviewId,
                candidateId: h.candidateId,
                eventType: types_1.ProctoringEventType.SESSION_ACTIVE,
                severity: 'low',
                description: `Heartbeat summary: ${h.count} beats in last interval`,
                metadata: { heartbeatCount: h.count, sourceType: 'desktop-app' },
            }));
            await models_1.ProctoringEvent.insertMany(docs);
        }
        catch (err) {
            logger_1.default.error('Error flushing heartbeat cache:', err);
        }
    }
}, HEARTBEAT_FLUSH_INTERVAL);
/**
 * @desc    Desktop app heartbeat
 * @route   POST /api/v1/proctoring/heartbeat
 * @access  Private (Desktop app with auth token)
 */
const sendHeartbeat = async (req, res) => {
    try {
        const { interviewId, status } = req.body;
        const interview = await models_1.Interview.findById(interviewId);
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // PERF-04: Track heartbeat in memory instead of writing to DB every interval
        const existing = heartbeatCache.get(interviewId);
        if (existing) {
            existing.lastSeen = Date.now();
            existing.count += 1;
        }
        else {
            heartbeatCache.set(interviewId, {
                candidateId: interview.candidateId,
                lastSeen: Date.now(),
                count: 1,
            });
        }
        // Check if interview has been terminated
        if (interview.status === types_1.InterviewStatus.CANCELLED) {
            return res.json({
                success: true,
                action: 'TERMINATE',
                message: interview.metadata?.terminationReason || 'Interview has been terminated',
                interviewStatus: interview.status,
            });
        }
        return (0, response_1.sendSuccess)(res, {
            interviewStatus: interview.status,
            criticalViolations: interview.metadata?.criticalViolations || 0,
            maxViolations: 3,
        });
    }
    catch (error) {
        logger_1.default.error('Error processing heartbeat:', error);
        return (0, response_1.sendError)(res, error.message || 'Error processing heartbeat', 500);
    }
};
exports.sendHeartbeat = sendHeartbeat;
/**
 * @desc    Get interview status for desktop app
 * @route   GET /api/v1/proctoring/interview-status/:interviewId
 * @access  Private (Desktop app with auth token)
 */
const getInterviewStatus = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const interview = await models_1.Interview.findById(interviewId)
            .select('status scheduledTime duration metadata candidateId companyId')
            .lean();
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        return (0, response_1.sendSuccess)(res, {
            interviewId,
            status: interview.status,
            scheduledTime: interview.scheduledTime,
            duration: interview.duration,
            criticalViolations: interview.metadata?.criticalViolations || 0,
            isTerminated: interview.status === types_1.InterviewStatus.CANCELLED,
            terminationReason: interview.metadata?.terminationReason,
        });
    }
    catch (error) {
        logger_1.default.error('Error getting interview status:', error);
        return (0, response_1.sendError)(res, error.message || 'Error getting interview status', 500);
    }
};
exports.getInterviewStatus = getInterviewStatus;
/**
 * @desc    Get recent proctoring events (for HR dashboard)
 * @route   GET /api/v1/proctoring/events/recent
 * @access  Private (HR/Admin)
 */
const getRecentProctoringEvents = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const companyId = req.user?.companyId;
        // Build query based on user role
        let query = {};
        if (req.user?.role !== 'admin') {
            // HR users only see events from their company's interviews
            const interviews = await models_1.Interview.find({ companyId }).select('_id');
            const interviewIds = interviews.map((i) => i._id);
            query.interviewId = { $in: interviewIds };
        }
        const events = await models_1.ProctoringEvent.find(query)
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
        return (0, response_1.sendSuccess)(res, events, 'Recent proctoring events retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error getting recent proctoring events:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching recent events', 500);
    }
};
exports.getRecentProctoringEvents = getRecentProctoringEvents;
//# sourceMappingURL=proctoringController.js.map