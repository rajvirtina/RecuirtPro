import { Router } from 'express';
import { query } from 'express-validator';
import {
  getFunnel,
  getApplicationsOverTime,
  getSourceBreakdown,
  getTimeToHire,
  getRecruiterProductivity,
  getOfferRate,
  getAIScoreDistribution,
  exportAnalytics,
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

/** Bulk CSV export for any report type */
router.get(
  '/export',
  protect,
  authorize(...hrAdminEmployer),
  [
    query('type').optional().isIn(['funnel','applications','source','time-to-hire','recruiter','offers','ai-scores'])
      .withMessage('type must be one of: funnel, applications, source, time-to-hire, recruiter, offers, ai-scores'),
    ...dateQueryValidators,
  ],
  validate,
  exportAnalytics
);

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

/** Offer acceptance rate breakdown */
router.get(
  '/offer-rate',
  protect,
  authorize(...hrAdminEmployer),
  dateQueryValidators,
  validate,
  getOfferRate
);

/** AI interview score distribution histogram */
router.get(
  '/ai-score-distribution',
  protect,
  authorize(...hrAdminEmployer),
  dateQueryValidators,
  validate,
  getAIScoreDistribution
);

export default router;
