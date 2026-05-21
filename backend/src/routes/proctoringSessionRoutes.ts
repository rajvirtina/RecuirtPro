/**
 * Session-based proctoring routes for the AI interview room.
 *
 * Public routes (no JWT — 64-char session token in the URL is the credential):
 *   POST /session/:sessionId/consent    — candidate grants/declines monitoring consent
 *   POST /session/:sessionId/violation  — real-time violation from browser monitor
 *
 * Protected routes (JWT required, HR/Admin/Employer):
 *   GET  /application/:applicationId/report — structured report for ApplicationDetail
 */
import { Router } from 'express';
import { param, body } from 'express-validator';
import {
  recordConsent,
  logSessionViolation,
  getProctoringReportByApplication,
} from '../controllers/proctoringController';
import { protect, authorize } from '../middleware/auth';
import { validate }           from '../middleware/validator';
import { UserRole }           from '../types';

const router = Router();

const SESSION_ID_PARAM = param('sessionId')
  .isLength({ min: 64, max: 64 })
  .withMessage('Invalid session ID format');

const APPLICATION_ID_PARAM = param('applicationId')
  .isMongoId()
  .withMessage('Valid applicationId is required');

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * @route  POST /api/v1/proctoring/session/:sessionId/consent
 * @desc   Candidate grants or declines proctoring consent
 */
router.post(
  '/session/:sessionId/consent',
  [
    SESSION_ID_PARAM,
    body('consented').isBoolean().withMessage('consented must be a boolean'),
    body('timestamp').optional().isISO8601(),
    body('userAgent').optional().isString(),
  ],
  validate,
  recordConsent
);

/**
 * @route  POST /api/v1/proctoring/session/:sessionId/violation
 * @desc   Browser monitoring layer reports a real-time violation
 */
router.post(
  '/session/:sessionId/violation',
  [
    SESSION_ID_PARAM,
    body('type').notEmpty().isIn(['tab_switch', 'window_blur', 'multiple_faces', 'no_face', 'copy_attempt']),
    body('severity').notEmpty().isIn(['low', 'medium', 'high', 'critical']),
    body('timestamp').optional().isISO8601(),
    body('screenshotBase64').optional().isString(),
  ],
  validate,
  logSessionViolation
);

// ─── Protected routes ─────────────────────────────────────────────────────────

router.use(protect);

/**
 * @route  GET /api/v1/proctoring/application/:applicationId/report
 * @desc   Full proctoring report for use in ApplicationDetail "Proctoring" tab
 */
router.get(
  '/application/:applicationId/report',
  authorize(UserRole.HR, UserRole.ADMIN, UserRole.EMPLOYER),
  [APPLICATION_ID_PARAM],
  validate,
  getProctoringReportByApplication
);

export default router;
