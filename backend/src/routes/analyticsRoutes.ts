import { Router } from 'express';
import { query } from 'express-validator';
import {
  getFunnel,
  getApplicationsOverTime,
  getSourceBreakdown,
  getTimeToHire,
  getRecruiterProductivity,
} from '../controllers/analyticsController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { UserRole } from '../types';

const router = Router();

const hrAdminEmployer = [UserRole.HR, UserRole.ADMIN, UserRole.EMPLOYER];

const dateQueryValidators = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
];

/** Conversion funnel: Applied → Shortlisted → Interviewed → Offer Sent → Hired */
router.get(
  '/funnel',
  protect,
  authorize(...hrAdminEmployer),
  dateQueryValidators,
  validate,
  getFunnel
);

/** Daily application volume with AI-qualified line */
router.get(
  '/applications-over-time',
  protect,
  authorize(...hrAdminEmployer),
  [
    query('period').optional().matches(/^\d+d$/).withMessage("period must be in format '30d'"),
    ...dateQueryValidators,
  ],
  validate,
  getApplicationsOverTime
);

/** Application source breakdown (direct, naukri, linkedin …) */
router.get(
  '/source-breakdown',
  protect,
  authorize(...hrAdminEmployer),
  dateQueryValidators,
  validate,
  getSourceBreakdown
);

/** Average days-to-hire grouped by department */
router.get(
  '/time-to-hire',
  protect,
  authorize(...hrAdminEmployer),
  [
    query('groupBy').optional().isIn(['department', 'role']),
    ...dateQueryValidators,
  ],
  validate,
  getTimeToHire
);

/** Per-recruiter activity: applications, interviews, offers, response time */
router.get(
  '/recruiter-productivity',
  protect,
  authorize(...hrAdminEmployer),
  dateQueryValidators,
  validate,
  getRecruiterProductivity
);

export default router;
