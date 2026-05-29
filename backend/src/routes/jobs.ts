import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getJobs,
  getJobById,
  getJobsByCompanySlug,
  getCompanyInfoBySlug,
  createJob,
  updateJob,
  updateJobStatus,
  approveJob,
  rejectJobApproval,
  deleteJob,
} from '../controllers/jobController';
import { duplicateJob } from '../controllers/jobTemplateController';
import { postToNaukri, postToLinkedIn, getJobPostings } from '../controllers/jobPostingController';
import { protect, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();

/**
 * @route   GET /api/v1/jobs
 * @desc    Get all jobs with filters
 * @access  Public (optionalAuth - filters by company if authenticated HR/employer)
 */
router.get('/', optionalAuth, getJobs);

/**
 * @route   GET /api/v1/jobs/company/:slug/info
 * @desc    Get public company info by slug (used for registration lookup)
 * @access  Public
 */
router.get('/company/:slug/info', getCompanyInfoBySlug);

/**
 * @route   GET /api/v1/jobs/company/:slug
 * @desc    Get jobs by company slug
 * @access  Public
 */
router.get('/company/:slug', optionalAuth, getJobsByCompanySlug);

/**
 * @route   GET /api/v1/jobs/:id
 * @desc    Get job by ID
 * @access  Public (optionalAuth - checks company authorization for HR/employer)
 */
router.get(
  '/:id',
  optionalAuth,
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
    // Description is required only for 'published' jobs; drafts may omit it
    body('description').optional({ nullable: true, checkFalsy: false }).trim(),
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
 * @route   PATCH /api/v1/jobs/:id/status
 * @desc    Update job status (Publish / Hold / Close)
 * @access  Private (Employer, HR, Admin)
 */
router.patch(
  '/:id/status',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid job ID'),
    body('status')
      .notEmpty()
      .isIn(['draft', 'pending_approval', 'published', 'on_hold', 'closed'])
      .withMessage('Status must be one of: draft, pending_approval, published, on_hold, closed'),
  ],
  validate,
  updateJobStatus
);

/**
 * @route   DELETE /api/v1/jobs/:id
 * @desc    Delete job (soft delete)
 * @access  Private (HR, Admin only — Employers may not delete jobs)
 */
router.delete(
  '/:id',
  protect,
  authorize(UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  deleteJob
);

/**
 * @route   PATCH /api/v1/jobs/:id/approve
 * @desc    Approve a pending-approval job and publish it
 * @access  Private (Employer, Admin only)
 */
router.patch(
  '/:id/approve',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  approveJob
);

/**
 * @route   PATCH /api/v1/jobs/:id/reject-approval
 * @desc    Reject job approval — returns it to draft
 * @access  Private (Employer, Admin only)
 */
router.patch(
  '/:id/reject-approval',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid job ID'),
    body('remarks').optional().isString().trim(),
  ],
  validate,
  rejectJobApproval
);

/**
 * @route   POST /api/v1/jobs/:id/duplicate
 * @desc    Duplicate a job as a new draft
 * @access  Private (Employer, HR, Admin)
 */
router.post(
  '/:id/duplicate',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  duplicateJob
);

/**
 * @route   GET /api/v1/jobs/:id/postings
 * @desc    Get external job board posting status
 * @access  Private (Employer, HR, Admin)
 */
router.get(
  '/:id/postings',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  getJobPostings
);

/**
 * @route   POST /api/v1/jobs/:id/post/naukri
 * @desc    Post job to Naukri.com via their Job Posting API
 * @access  Private (Employer, HR, Admin)
 */
router.post(
  '/:id/post/naukri',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  postToNaukri
);

/**
 * @route   POST /api/v1/jobs/:id/post/linkedin
 * @desc    Post job to LinkedIn via the LinkedIn Jobs Posting API
 * @access  Private (Employer, HR, Admin)
 */
router.post(
  '/:id/post/linkedin',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  [param('id').isMongoId().withMessage('Invalid job ID')],
  validate,
  postToLinkedIn
);

export default router;
