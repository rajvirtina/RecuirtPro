import { Request, Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc  Create an AI Interview Session for a scheduled interview (HR/Admin)
 * @route POST /api/v1/ai-interviews
 * @auth  JWT required (HR / Admin / Employer)
 */
export declare const createSession: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc  Get public session info (no auth — session token IS the credential)
 * @route GET /api/v1/ai-interviews/session/:sessionId
 */
export declare const getSession: (req: Request, res: Response) => Promise<void>;
/**
 * @desc  Candidate gives consent and starts the interview — generates questions via LLM
 * @route POST /api/v1/ai-interviews/session/:sessionId/start
 */
export declare const startSession: (req: Request, res: Response) => Promise<void>;
/**
 * @desc  Candidate submits an answer; LLM evaluates it and returns the next question
 * @route POST /api/v1/ai-interviews/session/:sessionId/answer
 */
export declare const submitAnswer: (req: Request, res: Response) => Promise<void>;
/**
 * @desc  Explicitly complete a session (called if candidate exits early or connection drops)
 * @route POST /api/v1/ai-interviews/session/:sessionId/complete
 */
export declare const completeSession: (req: Request, res: Response) => Promise<void>;
/**
 * @desc  HR/Admin: get full session detail including responses and analysis
 * @route GET /api/v1/ai-interviews/:interviewId/session
 * @auth  JWT required
 */
export declare const getSessionForReview: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc  Candidate flags a technical/content issue — logs it without touching session status
 * @route POST /api/v1/ai-interviews/session/:sessionId/flag
 * @auth  Public (session ID is the credential)
 */
export declare const flagSession: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=aiInterviewController.d.ts.map