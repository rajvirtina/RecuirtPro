import { Router } from 'express';
import { query } from 'express-validator';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { getPipeline } from '../controllers/pipelineController';
import { UserRole } from '../types';

const router = Router();

/**
 * @route   GET /api/v1/pipeline
 * @desc    Get applications grouped by stage, optionally filtered by jobId
 * @access  Private (HR, Employer, Admin, Interviewer)
 */
router.get(
  '/',
  protect,
  authorize(UserRole.HR, UserRole.EMPLOYER, UserRole.ADMIN, UserRole.INTERVIEWER),
  [
    query('jobId').optional().isMongoId().withMessage('Invalid job ID'),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  validate,
  getPipeline
);

export default router;
