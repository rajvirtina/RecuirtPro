import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Verify system readiness for proctored interview
 * @route   POST /api/v1/proctoring/verify/:interviewId
 * @access  Public (Candidate with interview link)
 */
export declare const verifySystemReadiness: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Log proctoring event during interview
 * @route   POST /api/v1/proctoring/event
 * @access  Public (During active interview)
 */
export declare const logProctoringEvent: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get proctoring events for an interview
 * @route   GET /api/v1/proctoring/events/:interviewId
 * @access  Private (Employer/HR/Admin)
 */
export declare const getProctoringEvents: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Review proctoring event
 * @route   PUT /api/v1/proctoring/event/:id/review
 * @access  Private (Employer/HR/Admin)
 */
export declare const reviewProctoringEvent: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get system check status for an interview
 * @route   GET /api/v1/proctoring/system-check/:interviewId
 * @access  Public (Candidate with interview link)
 */
export declare const getSystemCheckStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Report desktop app proctoring event
 * @route   POST /api/v1/proctoring/desktop-event
 * @access  Private (Desktop app with auth token)
 */
export declare const reportDesktopEvent: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Desktop app heartbeat
 * @route   POST /api/v1/proctoring/heartbeat
 * @access  Private (Desktop app with auth token)
 */
export declare const sendHeartbeat: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get interview status for desktop app
 * @route   GET /api/v1/proctoring/interview-status/:interviewId
 * @access  Private (Desktop app with auth token)
 */
export declare const getInterviewStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get recent proctoring events (for HR dashboard)
 * @route   GET /api/v1/proctoring/events/recent
 * @access  Private (HR/Admin)
 */
export declare const getRecentProctoringEvents: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=proctoringController.d.ts.map