import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as interviewController from '../controllers/interviewController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();

/**
 * @swagger
 * /api/v1/interviews:
 *   post:
 *     summary: Schedule an interview
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Interview scheduled successfully
 */
router.post(
  '/',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    body('applicationId').notEmpty().isMongoId().withMessage('Valid application ID is required'),
    body('jobId').notEmpty().isMongoId().withMessage('Valid job ID is required'),
    body('candidateId').notEmpty().isMongoId().withMessage('Valid candidate ID is required'),
    body('scheduledTime')
      .notEmpty().isISO8601().withMessage('Valid scheduled time is required')
      .custom((val: string) => {
        // VAL-005: Reject past dates
        if (new Date(val) <= new Date()) {
          throw new Error('Interview must be scheduled in the future');
        }
        return true;
      }),
    body('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15-480 minutes'),
    body('mode').optional().isIn(['onsite', 'online', 'hybrid']),
    body('location').optional().isString(),
    body('meetingLink').optional().isURL().withMessage('Valid meeting link required'),
    body('panel').optional().isArray(),
    body('round').optional().isIn(['L1', 'L2', 'L3', 'HR', 'technical', 'managerial']),
    body('interviewTemplateId').optional().isMongoId(),
  ],
  validate,
  interviewController.scheduleInterview
);

/**
 * @swagger
 * /api/v1/interviews:
 *   get:
 *     summary: Get all interviews
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interviews retrieved successfully
 */
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('jobId').optional().isMongoId(),
    query('candidateId').optional().isMongoId(),
    query('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  interviewController.getInterviews
);

/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   get:
 *     summary: Get single interview by ID
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview retrieved successfully
 */
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Valid interview ID is required')],
  validate,
  interviewController.getInterviewById
);

/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   put:
 *     summary: Update interview details
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview updated successfully
 */
router.put(
  '/:id',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Valid interview ID is required'),
    body('scheduledTime').optional().isISO8601(),
    body('duration').optional().isInt({ min: 15, max: 480 }),
    body('mode').optional().isIn(['onsite', 'online', 'hybrid']),
    body('location').optional().isString(),
    body('meetingLink').optional().isURL(),
    body('panel').optional().isArray(),
    body('instructions').optional().isString(),
  ],
  validate,
  interviewController.updateInterview
);

/**
 * @swagger
 * /api/v1/interviews/{id}/status:
 *   put:
 *     summary: Update interview status and add feedback
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview status updated
 */
router.put(
  '/:id/status',
  protect,
  [
    param('id').isMongoId().withMessage('Valid interview ID is required'),
    body('status')
      .notEmpty()
      .isIn(['confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled'])
      .withMessage('Valid status is required'),
    body('feedback').optional().isString().isLength({ max: 2000 }),
    body('rating').optional().isInt({ min: 1, max: 5 }),
  ],
  validate,
  interviewController.updateInterviewStatus
);

/**
 * @swagger
 * /api/v1/interviews/{id}/start:
 *   post:
 *     summary: Start an interview (mark as in progress)
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview started successfully
 */
router.post(
  '/:id/start',
  protect,
  [param('id').isMongoId().withMessage('Valid interview ID is required')],
  validate,
  interviewController.startInterview
);

/**
 * @swagger
 * /api/v1/interviews/{id}/feedback:
 *   post:
 *     summary: Submit interview feedback and next round decision
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 */
router.post(
  '/:id/feedback',
  protect,
  [
    param('id').isMongoId().withMessage('Valid interview ID is required'),
    body('rating').notEmpty().isInt({ min: 1, max: 5 }).withMessage('Rating (1-5) is required'),
    body('comments').notEmpty().isString().isLength({ max: 2000 }).withMessage('Feedback comments are required'),
    body('recommendation')
      .notEmpty()
      .isIn(['strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire'])
      .withMessage('Valid recommendation is required'),
    body('finalDecision')
      .notEmpty()
      .isIn(['selected', 'rejected', 'on_hold'])
      .withMessage('Final decision for next round is required'),
  ],
  validate,
  interviewController.submitInterviewFeedback
);

/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   delete:
 *     summary: Cancel interview
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview cancelled successfully
 */
router.delete(
  '/:id',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Valid interview ID is required'),
    body('reason').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  interviewController.cancelInterview
);

export default router;
