import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc  Conversion funnel: Applied → Shortlisted → Interviewed → Offer Sent → Hired
 * @route GET /api/v1/analytics/funnel?startDate=&endDate=
 */
export declare const getFunnel: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc  Daily application count (total + AI-qualified)
 * @route GET /api/v1/analytics/applications-over-time?period=30d  OR  ?startDate=&endDate=
 */
export declare const getApplicationsOverTime: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc  Application source breakdown (direct, naukri, linkedin, referral, …)
 * @route GET /api/v1/analytics/source-breakdown?startDate=&endDate=
 */
export declare const getSourceBreakdown: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc  Average days to hire grouped by job department
 * @route GET /api/v1/analytics/time-to-hire?groupBy=department
 */
export declare const getTimeToHire: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc  Per-recruiter activity: applications reviewed, interviews, offers, avg response time
 * @route GET /api/v1/analytics/recruiter-productivity?startDate=&endDate=
 */
export declare const getRecruiterProductivity: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=analyticsController.d.ts.map