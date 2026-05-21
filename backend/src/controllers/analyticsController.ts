import mongoose from 'mongoose';
import { Response } from 'express';
import { Application, Interview, User } from '../models';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { getTenantCompanyId } from '../middleware/auth';
import logger from '../utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDates(req: AuthRequest) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const start = req.query.startDate
    ? new Date(req.query.startDate as string)
    : thirtyDaysAgo;
  const end = req.query.endDate
    ? new Date(req.query.endDate as string)
    : now;

  // Clamp end to end-of-day
  end.setHours(23, 59, 59, 999);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
  }
  return { start, end };
}

function oid(id: string | null): mongoose.Types.ObjectId | null {
  if (!id) return null;
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
}

function convRate(num: number, denom: number) {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}

// ─── 1. Conversion Funnel ─────────────────────────────────────────────────────

/**
 * @desc  Conversion funnel: Applied → Shortlisted → Interviewed → Offer Sent → Hired
 * @route GET /api/v1/analytics/funnel?startDate=&endDate=
 */
export const getFunnel = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    const baseMatch: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
    if (tenantId) baseMatch.companyId = oid(tenantId);

    const statusCounts = await Application.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    statusCounts.forEach(({ _id, count }) => { counts[_id] = count; });

    // Cumulative funnel: each stage includes all downstream stages
    const ALL_STATUSES = ['applied','shortlisted','interview_scheduled','in_progress','selected','hired','offer_released','rejected','on_hold','withdrawn'];
    const SHORTLISTED_UP = ['shortlisted','interview_scheduled','in_progress','selected','hired','offer_released'];
    const INTERVIEWED_UP = ['interview_scheduled','in_progress','selected','hired','offer_released'];
    const OFFER_UP       = ['offer_released','hired'];

    const sum = (statuses: string[]) => statuses.reduce((s, k) => s + (counts[k] ?? 0), 0);

    const applied     = sum(ALL_STATUSES);
    const shortlisted = sum(SHORTLISTED_UP);
    const interviewed = sum(INTERVIEWED_UP);
    const offerSent   = sum(OFFER_UP);
    const hired       = counts['hired'] ?? 0;

    const funnel = [
      { stage: 'Applied',     count: applied,     conversionRate: 100 },
      { stage: 'Shortlisted', count: shortlisted,  conversionRate: convRate(shortlisted, applied) },
      { stage: 'Interviewed', count: interviewed,  conversionRate: convRate(interviewed, shortlisted) },
      { stage: 'Offer Sent',  count: offerSent,    conversionRate: convRate(offerSent, interviewed) },
      { stage: 'Hired',       count: hired,        conversionRate: convRate(hired, offerSent) },
    ];

    return sendSuccess(res, {
      funnel,
      summary: {
        totalApplications: applied,
        hired,
        overallConversionRate: convRate(hired, applied),
        shortlisted,
        interviewed,
      },
    }, 'Funnel data retrieved');
  } catch (error: any) {
    logger.error('getFunnel error:', error);
    return sendError(res, error.message || 'Failed to retrieve funnel data', 500);
  }
};

// ─── 2. Applications Over Time ───────────────────────────────────────────────

/**
 * @desc  Daily application count (total + AI-qualified)
 * @route GET /api/v1/analytics/applications-over-time?period=30d  OR  ?startDate=&endDate=
 */
export const getApplicationsOverTime = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);

    // Support period shorthand (30d, 7d, 90d) OR explicit start/end
    let start: Date, end: Date;
    if (req.query.period) {
      const days = parseInt((req.query.period as string).replace('d', '')) || 30;
      end   = new Date(); end.setHours(23, 59, 59, 999);
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    } else {
      ({ start, end } = parseDates(req));
    }

    const baseMatch: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
    if (tenantId) baseMatch.companyId = oid(tenantId);

    const agg = await Application.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          total:     { $sum: 1 },
          qualified: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$overallScore', 0] }, 70] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const series = agg.map(item => ({
      date:      `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      total:     item.total,
      qualified: item.qualified,
    }));

    return sendSuccess(res, { series }, 'Applications over time retrieved');
  } catch (error: any) {
    logger.error('getApplicationsOverTime error:', error);
    return sendError(res, error.message || 'Failed to retrieve time series', 500);
  }
};

// ─── 3. Source Breakdown ─────────────────────────────────────────────────────

/**
 * @desc  Application source breakdown (direct, naukri, linkedin, referral, …)
 * @route GET /api/v1/analytics/source-breakdown?startDate=&endDate=
 */
export const getSourceBreakdown = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    const baseMatch: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
    if (tenantId) baseMatch.companyId = oid(tenantId);

    const agg = await Application.aggregate([
      { $match: baseMatch },
      { $group: { _id: { $ifNull: ['$source', 'direct'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = agg.reduce((s, x) => s + x.count, 0);
    const sources = agg.map(x => ({
      source:     String(x._id),
      count:      x.count,
      percentage: total > 0 ? Math.round((x.count / total) * 100) : 0,
    }));

    return sendSuccess(res, { sources, total }, 'Source breakdown retrieved');
  } catch (error: any) {
    logger.error('getSourceBreakdown error:', error);
    return sendError(res, error.message || 'Failed to retrieve source data', 500);
  }
};

// ─── 4. Time to Hire by Department ──────────────────────────────────────────

/**
 * @desc  Average days to hire grouped by job department
 * @route GET /api/v1/analytics/time-to-hire?groupBy=department
 */
export const getTimeToHire = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);

    const baseMatch: any = {
      deletedAt: null,
      status: 'hired',
      hiredAt:   { $exists: true, $ne: null },
    };
    if (tenantId) baseMatch.companyId = oid(tenantId);

    // Optional date filter on hiredAt
    if (req.query.startDate || req.query.endDate) {
      const { start, end } = parseDates(req);
      baseMatch.hiredAt = { $gte: start, $lte: end };
    }

    const agg = await Application.aggregate([
      { $match: baseMatch },
      {
        $lookup: {
          from:         'jobs',
          localField:   'jobId',
          foreignField: '_id',
          as:           'job',
        },
      },
      { $unwind: { path: '$job', preserveNullAndEmpty: true } },
      {
        $group: {
          _id:    { $ifNull: ['$job.department', 'Unspecified'] },
          avgMs:  { $avg: { $subtract: ['$hiredAt', '$appliedAt'] } },
          count:  { $sum: 1 },
          minDays:{ $min: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86_400_000] } },
          maxDays:{ $max: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86_400_000] } },
        },
      },
      { $sort: { avgMs: 1 } },
    ]);

    const departments = agg.map(x => ({
      department: x._id,
      avgDays:    Math.round((x.avgMs / 86_400_000) * 10) / 10,
      count:      x.count,
      minDays:    Math.round(x.minDays * 10) / 10,
      maxDays:    Math.round(x.maxDays * 10) / 10,
    }));

    const companyAvg = departments.length > 0
      ? Math.round(departments.reduce((s, d) => s + d.avgDays, 0) / departments.length * 10) / 10
      : 0;

    return sendSuccess(res, { departments, companyAvg }, 'Time-to-hire data retrieved');
  } catch (error: any) {
    logger.error('getTimeToHire error:', error);
    return sendError(res, error.message || 'Failed to retrieve time-to-hire data', 500);
  }
};

// ─── 5. Recruiter Productivity ────────────────────────────────────────────────

/**
 * @desc  Per-recruiter activity: applications reviewed, interviews, offers, avg response time
 * @route GET /api/v1/analytics/recruiter-productivity?startDate=&endDate=
 */
export const getRecruiterProductivity = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    // Find all HR / Employer / Admin users for this company
    const userMatch: any = {
      role:      { $in: ['hr', 'employer', 'admin'] },
      deletedAt: null,
      status:    'active',
    };
    if (tenantId) userMatch.companyId = oid(tenantId);

    const hrUsers = await User.find(userMatch)
      .select('_id firstName lastName email')
      .lean();

    if (hrUsers.length === 0) {
      return sendSuccess(res, { recruiters: [] }, 'No HR users found');
    }

    const recruiters = await Promise.all(
      hrUsers.map(async (u) => {
        const userId  = new mongoose.Types.ObjectId(String(u._id));
        const appBase: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
        if (tenantId) appBase.companyId = oid(tenantId);

        const [appsReviewed, interviewsScheduled, offersMade, responseAgg] = await Promise.all([
          // Applications this recruiter touched (any status change by them)
          Application.countDocuments({ ...appBase, 'statusHistory.changedBy': userId }),

          // Interviews they scheduled
          Interview.countDocuments({
            ...(tenantId ? { companyId: oid(tenantId) } : {}),
            scheduledBy: userId,
            createdAt:   { $gte: start, $lte: end },
          }),

          // Offers they made (status → offer_released)
          Application.countDocuments({
            ...(tenantId ? { companyId: oid(tenantId) } : {}),
            deletedAt: null,
            statusHistory: {
              $elemMatch: {
                status:    'offer_released',
                changedBy: userId,
                changedAt: { $gte: start, $lte: end },
              },
            },
          }),

          // Average response time (hours from appliedAt to first status change by this user)
          Application.aggregate([
            { $match: { ...appBase, 'statusHistory.changedBy': userId } },
            { $unwind: '$statusHistory' },
            { $match: { 'statusHistory.changedBy': userId } },
            { $sort:  { 'statusHistory.changedAt': 1 } },
            { $group: { _id: '$_id', first: { $first: '$statusHistory.changedAt' }, applied: { $first: '$appliedAt' } } },
            { $project: { hours: { $divide: [{ $subtract: ['$first', '$applied'] }, 3_600_000] } } },
            { $group: { _id: null, avg: { $avg: '$hours' } } },
          ]),
        ]);

        return {
          id:                   String(u._id),
          name:                 `${u.firstName} ${u.lastName}`,
          email:                u.email,
          applicationsReviewed: appsReviewed,
          interviewsScheduled,
          offersMade,
          avgResponseTimeHours: responseAgg[0]?.avg != null
            ? Math.round(responseAgg[0].avg * 10) / 10
            : null,
        };
      })
    );

    // Only return users who had at least one activity in range
    const active = recruiters.filter(
      r => r.applicationsReviewed > 0 || r.interviewsScheduled > 0 || r.offersMade > 0
    );

    return sendSuccess(res, { recruiters: active }, 'Recruiter productivity retrieved');
  } catch (error: any) {
    logger.error('getRecruiterProductivity error:', error);
    return sendError(res, error.message || 'Failed to retrieve recruiter data', 500);
  }
};
