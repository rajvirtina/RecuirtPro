import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createSession,
  getSession,
  startSession,
  submitAnswer,
  completeSession,
  flagSession,
  getSessionForReview,
} from '../controllers/aiInterviewController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';
import { aiAnswerLimiter } from '../middleware/rateLimiter';

const router = Router();

// ─── Protected (HR/Admin): manage sessions ────────────────────────────────────

/**
 * @route  POST /api/v1/ai-interviews
 * @desc   Create an AI interview session for a scheduled interview
 * @access HR / Admin / Employer
 */
router.post(
  '/',
  protect,
  authorize(UserRole.HR, UserRole.ADMIN, UserRole.EMPLOYER),
  [
    body('interviewId').notEmpty().isMongoId().withMessage('Valid interviewId is required'),
    body('difficulty').optional().isIn(['junior', 'senior', 'expert']),
    body('numQuestions').optional().isInt({ min: 3, max: 12 }),
  ],
  validate,
  createSession
);

/**
 * @route  GET /api/v1/ai-interviews/:interviewId/session
 * @desc   HR/Admin review of a completed AI session
 * @access HR / Admin
 */
router.get(
  '/:interviewId/session',
  protect,
  authorize(UserRole.HR, UserRole.ADMIN, UserRole.EMPLOYER),
  [param('interviewId').isMongoId().withMessage('Valid interviewId is required')],
  validate,
  getSessionForReview
);

// ─── Public (session token = credential): candidate interview flow ─────────────

/**
 * @route  GET /api/v1/ai-interviews/session/:sessionId
 * @desc   Fetch session metadata — no auth required
 */
router.get(
  '/session/:sessionId',
  [param('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID')],
  validate,
  getSession
);

/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/start
 * @desc   Candidate gives consent + triggers question generation
 */
router.post(
  '/session/:sessionId/start',
  [
    param('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID'),
    body('consentGiven').isBoolean().withMessage('consentGiven must be a boolean'),
  ],
  validate,
  startSession
);

/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/answer
 * @desc   Submit candidate response; evaluates and returns next question
 */
router.post(
  '/session/:sessionId/answer',
  aiAnswerLimiter,
  [
    param('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID'),
    body('questionId').notEmpty().withMessage('questionId is required'),
    body('responseText').notEmpty().trim().isLength({ min: 1, max: 3000 }).withMessage('responseText is required (max 3000 chars)'),
    body('responseTimeSeconds').optional().isInt({ min: 0, max: 3600 }),
  ],
  validate,
  submitAnswer
);

/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/complete
 * @desc   Explicitly close a session (early exit / connection drop)
 */
router.post(
  '/session/:sessionId/complete',
  [param('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID')],
  validate,
  completeSession
);

/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/flag
 * @desc   Candidate reports a technical/content issue — logs it, does NOT end the session
 */
router.post(
  '/session/:sessionId/flag',
  [
    param('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID'),
    body('reason').trim().notEmpty().isLength({ max: 500 }).withMessage('reason is required (max 500 chars)'),
  ],
  validate,
  flagSession
);

export default router;
