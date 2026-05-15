import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Schedule an interview
 * @route   POST /api/v1/interviews
 * @access  Private (Employer/HR/Admin)
 */
export declare const scheduleInterview: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get all interviews (with filters)
 * @route   GET /api/v1/interviews
 * @access  Private
 */
export declare const getInterviews: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get single interview by ID
 * @route   GET /api/v1/interviews/:id
 * @access  Private
 */
export declare const getInterviewById: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update interview (reschedule, update details)
 * @route   PUT /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
export declare const updateInterview: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update interview status
 * @route   PUT /api/v1/interviews/:id/status
 * @access  Private (Panel members, Employer/HR/Admin)
 */
export declare const updateInterviewStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Cancel interview
 * @route   DELETE /api/v1/interviews/:id
 * @access  Private (Employer/HR/Admin)
 */
export declare const cancelInterview: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Submit interview feedback and next round decision
 * @route   POST /api/v1/interviews/:id/feedback
 * @access  Private (Panel members, Employer/HR/Admin)
 */
export declare const submitInterviewFeedback: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Start interview - mark as in progress and generate questions using LLM
 * @route   POST /api/v1/interviews/:id/start
 * @access  Private (Panel members, Employer/HR/Admin, Candidate)
 */
export declare const startInterview: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=interviewController.d.ts.map