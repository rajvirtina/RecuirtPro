import { Router } from 'express';
import { param, body } from 'express-validator';
import {
  getJobTemplates,
  createJobTemplate,
  createTemplateFromJob,
  deleteJobTemplate,
  duplicateJob,
} from '../controllers/jobTemplateController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();
router.use(protect);
router.use(authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN));

// ─── Job Templates ───────────────────────────────────────────────────────────

router.get('/', getJobTemplates);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('title').trim().notEmpty().withMessage('Job title is required'),
  ],
  validate,
  createJobTemplate
);

router.post(
  '/from-job/:jobId',
  [
    param('jobId').isMongoId().withMessage('Invalid job ID'),
    body('name').trim().notEmpty().withMessage('Template name is required'),
  ],
  validate,
  createTemplateFromJob
);

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid template ID')],
  validate,
  deleteJobTemplate
);

export default router;
