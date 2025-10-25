import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} from '../controllers/jobController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();

/**
 * @route   GET /api/v1/jobs
 * @desc    Get all jobs with filters
 * @access  Public
 */
router.get('/', getJobs);

/**
 * @route   GET /api/v1/jobs/:id
 * @desc    Get job by ID
 * @access  Public
 */
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  getJobById
);

/**
 * @route   POST /api/v1/jobs
 * @desc    Create new job
 * @access  Private (Employer, HR, Admin)
 */
router.post(
  '/',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    body('title').trim().notEmpty().withMessage('Job title is required'),
    body('description').trim().notEmpty().withMessage('Job description is required'),
    body('companyId').optional().isMongoId().withMessage('Invalid company ID'),
    body('location').optional().trim(),
    body('jobType').optional().isIn(['full_time', 'part_time', 'contract', 'internship', 'temporary']),
    body('workMode').optional().isIn(['onsite', 'remote', 'hybrid']),
    body('experienceMin').optional().isInt({ min: 0 }).withMessage('Minimum experience must be a positive number'),
    body('experienceMax').optional().isInt({ min: 0 }).withMessage('Maximum experience must be a positive number'),
    body('salaryMin').optional().isInt({ min: 0 }).withMessage('Minimum salary must be a positive number'),
    body('salaryMax').optional().isInt({ min: 0 }).withMessage('Maximum salary must be a positive number'),
    body('skills').optional().isArray().withMessage('Skills must be an array'),
    body('currency').optional().trim(),
  ],
  validate,
  createJob
);

/**
 * @route   PUT /api/v1/jobs/:id
 * @desc    Update job
 * @access  Private (Employer, HR, Admin)
 */
router.put(
  '/:id',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid job ID'),
    body('title').optional().trim().notEmpty().withMessage('Job title cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Job description cannot be empty'),
    body('companyId').optional().isMongoId().withMessage('Invalid company ID'),
  ],
  validate,
  updateJob
);

/**
 * @route   DELETE /api/v1/jobs/:id
 * @desc    Delete job (soft delete)
 * @access  Private (Employer, HR, Admin)
 */
router.delete(
  '/:id',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  deleteJob
);

export default router;
