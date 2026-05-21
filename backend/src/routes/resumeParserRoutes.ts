import { Router } from 'express';
import { param } from 'express-validator';
import { parseResume, parseAllResumes, rankCandidates } from '../controllers/resumeParserController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();

const hrAdminEmployer = [UserRole.HR, UserRole.ADMIN, UserRole.EMPLOYER];

/**
 * @route  POST /api/v1/applications/:id/parse-resume
 * @desc   Extract skills, experience, education from the uploaded resume via LLM
 * @access HR / Admin / Employer
 */
router.post(
  '/applications/:id/parse-resume',
  protect,
  authorize(...hrAdminEmployer),
  [param('id').isMongoId().withMessage('Valid application ID is required')],
  validate,
  parseResume
);

/**
 * @route  POST /api/v1/jobs/:jobId/parse-all-resumes
 * @desc   Bulk-parse all unparsed resumes for a job
 * @access HR / Admin / Employer
 */
router.post(
  '/jobs/:jobId/parse-all-resumes',
  protect,
  authorize(...hrAdminEmployer),
  [param('jobId').isMongoId().withMessage('Valid job ID is required')],
  validate,
  parseAllResumes
);

/**
 * @route  POST /api/v1/jobs/:jobId/rank-candidates
 * @desc   Score and rank all parsed applications for a job
 * @access HR / Admin / Employer
 */
router.post(
  '/jobs/:jobId/rank-candidates',
  protect,
  authorize(...hrAdminEmployer),
  [param('jobId').isMongoId().withMessage('Valid job ID is required')],
  validate,
  rankCandidates
);

export default router;
