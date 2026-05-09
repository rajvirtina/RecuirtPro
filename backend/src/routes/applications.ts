import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as applicationController from '../controllers/applicationController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';
import { uploadResume, handleUploadError } from '../middleware/upload';

const router = Router();

/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     summary: Submit a job application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *             properties:
 *               jobId:
 *                 type: string
 *               coverLetter:
 *                 type: string
 *               resumeUrl:
 *                 type: string
 *               expectedSalary:
 *                 type: number
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *       400:
 *         description: Already applied or job not active
 *       404:
 *         description: Job not found
 */
router.post(
  '/',
  protect,
  authorize(UserRole.CANDIDATE),
  uploadResume.single('resume'),
  handleUploadError,
  [
    body('jobId').notEmpty().isMongoId().withMessage('Valid job ID is required'),
    body('coverLetter').optional().isString().isLength({ max: 2000 }),
    body('resumeUrl').optional().isURL().withMessage('Valid resume URL required'),
    body('expectedSalary').optional().isNumeric().withMessage('Expected salary must be a number'),
  ],
  validate,
  applicationController.submitApplication
);

/**
 * @swagger
 * /api/v1/applications/check/{jobId}:
 *   get:
 *     summary: Check if candidate has applied to a job
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application status retrieved
 */
router.get(
  '/check/:jobId',
  protect,
  authorize(UserRole.CANDIDATE),
  [param('jobId').isMongoId().withMessage('Valid job ID is required')],
  validate,
  applicationController.checkApplicationStatus
);

/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     summary: Get all applications (filtered by role)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitted, screening, shortlisted, rejected, interviewing, offered, hired, withdrawn]
 *       - in: query
 *         name: candidateId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 */
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('jobId').optional().isMongoId(),
    query('status').optional().isIn([
      'applied',
      'shortlisted',
      'interview_scheduled',
      'in_progress',
      'selected',
      'hired',
      'offer_released',
      'rejected',
      'on_hold',
      'withdrawn',
    ]),
    query('candidateId').optional().isMongoId(),
  ],
  validate,
  applicationController.getApplications
);

/**
 * @swagger
 * /api/v1/applications/stats:
 *   get:
 *     summary: Get application statistics
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
  '/stats',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [query('jobId').optional().isMongoId()],
  validate,
  applicationController.getApplicationStats
);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   get:
 *     summary: Get single application by ID
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application retrieved successfully
 *       404:
 *         description: Application not found
 */
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Valid application ID is required')],
  validate,
  applicationController.getApplicationById
);

/**
 * @swagger
 * /api/v1/applications/{id}/status:
 *   put:
 *     summary: Update application status
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [screening, shortlisted, rejected, interviewing, offered, hired]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application status updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Application not found
 */
router.put(
  '/:id/status',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Valid application ID is required'),
    body('status')
      .notEmpty()
      .isIn(['shortlisted', 'interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released', 'rejected', 'on_hold'])
      .withMessage('Valid status is required'),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  applicationController.updateApplicationStatus
);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   delete:
 *     summary: Withdraw application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application withdrawn successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Application not found
 */
router.delete(
  '/:id',
  protect,
  authorize(UserRole.CANDIDATE),
  [param('id').isMongoId().withMessage('Valid application ID is required')],
  validate,
  applicationController.withdrawApplication
);

/**
 * @swagger
 * /api/v1/applications/{id}/resume:
 *   get:
 *     summary: Download resume for an application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resume file
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Resume not found
 */
router.get(
  '/:id/resume',
  protect,
  [param('id').isMongoId().withMessage('Valid application ID is required')],
  validate,
  applicationController.downloadResume
);

export default router;
