import mongoose from 'mongoose';
import { Response } from 'express';
import { Application, Interview, User, Offer } from '../models';
import { AuthRequest, OfferStatus } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AIInterviewSession } = require('../models') as typeof import('../models');
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
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
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

// ─── 6. Offer Acceptance Rate ─────────────────────────────────────────────────

/**
 * @desc  Offer funnel: sent, accepted, rejected, negotiating, withdrawn
 * @route GET /api/v1/analytics/offer-rate?startDate=&endDate=
 */
export const getOfferRate = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    const match: any = { createdAt: { $gte: start, $lte: end } };
    if (tenantId) match.companyId = oid(tenantId);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Offer.aggregate(pipeline);

    const statusMap: Record<string, number> = {};
    results.forEach((r: any) => { statusMap[r._id] = r.count; });

    const total    = Object.values(statusMap).reduce((s, v) => s + v, 0);
    const sent     = (statusMap[OfferStatus.SENT] ?? 0) + (statusMap[OfferStatus.ACCEPTED] ?? 0) + (statusMap[OfferStatus.REJECTED] ?? 0) + (statusMap[OfferStatus.NEGOTIATING] ?? 0);
    const accepted = statusMap[OfferStatus.ACCEPTED] ?? 0;
    const rejected = statusMap[OfferStatus.REJECTED] ?? 0;
    const negotiating = statusMap[OfferStatus.NEGOTIATING] ?? 0;
    const withdrawn  = statusMap[OfferStatus.WITHDRAWN] ?? 0;

    return sendSuccess(res, {
      total,
      sent,
      accepted,
      rejected,
      negotiating,
      withdrawn,
      acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
      breakdown: [
        { label: 'Accepted',    value: accepted,    color: '#22c55e' },
        { label: 'Rejected',    value: rejected,    color: '#ef4444' },
        { label: 'Negotiating', value: negotiating, color: '#f59e0b' },
        { label: 'Withdrawn',   value: withdrawn,   color: '#6b7280' },
        { label: 'Pending',     value: (statusMap[OfferStatus.SENT] ?? 0), color: '#3b82f6' },
      ].filter(b => b.value > 0),
    }, 'Offer acceptance rate retrieved');
  } catch (error: any) {
    logger.error('getOfferRate error:', error);
    return sendError(res, error.message || 'Failed to retrieve offer data', 500);
  }
};

// ─── 8. CSV Bulk Export ───────────────────────────────────────────────────────

type CsvRow = Record<string, string | number | null>;

function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h] ?? null)).join(','))];
  return lines.join('\r\n');
}

/**
 * @desc  Bulk CSV export for any analytics report type
 * @route GET /api/v1/analytics/export?type=funnel|applications|source|time-to-hire|recruiter|offers|ai-scores&startDate=&endDate=
 */
export const exportAnalytics = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const type = (req.query.type as string) || 'funnel';
    const { start, end } = parseDates(req);

    const baseMatch: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
    if (tenantId) baseMatch.companyId = oid(tenantId);

    let rows: CsvRow[] = [];
    let filename = `analytics-${type}-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv`;

    if (type === 'funnel') {
      const statusCounts = await Application.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const counts: Record<string, number> = {};
      statusCounts.forEach(({ _id, count }) => { counts[_id] = count; });
      const ALL = ['applied','shortlisted','interview_scheduled','in_progress','selected','hired','offer_released','rejected','on_hold','withdrawn'];
      const SL  = ['shortlisted','interview_scheduled','in_progress','selected','hired','offer_released'];
      const INT = ['interview_scheduled','in_progress','selected','hired','offer_released'];
      const OFR = ['offer_released','hired'];
      const sum = (s: string[]) => s.reduce((a, k) => a + (counts[k] ?? 0), 0);
      const applied = sum(ALL), shortlisted = sum(SL), interviewed = sum(INT), offerSent = sum(OFR), hired = counts['hired'] ?? 0;
      rows = [
        { stage: 'Applied',     count: applied,     conversion_rate_pct: 100 },
        { stage: 'Shortlisted', count: shortlisted,  conversion_rate_pct: convRate(shortlisted, applied) },
        { stage: 'Interviewed', count: interviewed,  conversion_rate_pct: convRate(interviewed, shortlisted) },
        { stage: 'Offer Sent',  count: offerSent,    conversion_rate_pct: convRate(offerSent, interviewed) },
        { stage: 'Hired',       count: hired,        conversion_rate_pct: convRate(hired, offerSent) },
      ];

    } else if (type === 'applications') {
      const agg = await Application.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
            total: { $sum: 1 },
            qualified: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$overallScore', 0] }, 70] }, 1, 0] } },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      rows = agg.map(x => ({
        date:      `${x._id.year}-${String(x._id.month).padStart(2,'0')}-${String(x._id.day).padStart(2,'0')}`,
        total:     x.total,
        qualified: x.qualified,
      }));

    } else if (type === 'source') {
      const agg = await Application.aggregate([
        { $match: baseMatch },
        { $group: { _id: { $ifNull: ['$source', 'direct'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const total = agg.reduce((s, x) => s + x.count, 0);
      rows = agg.map(x => ({
        source: String(x._id),
        count:  x.count,
        percentage_pct: total > 0 ? Math.round((x.count / total) * 100) : 0,
      }));

    } else if (type === 'time-to-hire') {
      const hiredMatch: any = { deletedAt: null, status: 'hired', hiredAt: { $exists: true, $ne: null } };
      if (tenantId) hiredMatch.companyId = oid(tenantId);
      hiredMatch.hiredAt = { $gte: start, $lte: end };
      const agg = await Application.aggregate([
        { $match: hiredMatch },
        { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } },
        { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$job.department', 'Unspecified'] },
            avgMs:   { $avg: { $subtract: ['$hiredAt', '$appliedAt'] } },
            count:   { $sum: 1 },
            minDays: { $min: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86_400_000] } },
            maxDays: { $max: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86_400_000] } },
          },
        },
        { $sort: { avgMs: 1 } },
      ]);
      rows = agg.map(x => ({
        department: x._id,
        avg_days:   Math.round((x.avgMs / 86_400_000) * 10) / 10,
        min_days:   Math.round(x.minDays * 10) / 10,
        max_days:   Math.round(x.maxDays * 10) / 10,
        hires:      x.count,
      }));

    } else if (type === 'recruiter') {
      const userMatch: any = { role: { $in: ['hr', 'employer', 'admin'] }, deletedAt: null, status: 'active' };
      if (tenantId) userMatch.companyId = oid(tenantId);
      const hrUsers = await User.find(userMatch).select('_id firstName lastName email').lean();
      const appBase: any = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
      if (tenantId) appBase.companyId = oid(tenantId);
      const recruiters = await Promise.all(hrUsers.map(async (u) => {
        const userId = new mongoose.Types.ObjectId(String(u._id));
        const [appsReviewed, interviewsScheduled, offersMade, responseAgg] = await Promise.all([
          Application.countDocuments({ ...appBase, 'statusHistory.changedBy': userId }),
          Interview.countDocuments({ ...(tenantId ? { companyId: oid(tenantId) } : {}), scheduledBy: userId, createdAt: { $gte: start, $lte: end } }),
          Application.countDocuments({ ...(tenantId ? { companyId: oid(tenantId) } : {}), deletedAt: null, statusHistory: { $elemMatch: { status: 'offer_released', changedBy: userId, changedAt: { $gte: start, $lte: end } } } }),
          Application.aggregate([
            { $match: { ...appBase, 'statusHistory.changedBy': userId } },
            { $unwind: '$statusHistory' },
            { $match: { 'statusHistory.changedBy': userId } },
            { $sort: { 'statusHistory.changedAt': 1 } },
            { $group: { _id: '$_id', first: { $first: '$statusHistory.changedAt' }, applied: { $first: '$appliedAt' } } },
            { $project: { hours: { $divide: [{ $subtract: ['$first', '$applied'] }, 3_600_000] } } },
            { $group: { _id: null, avg: { $avg: '$hours' } } },
          ]),
        ]);
        return {
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          applications_reviewed: appsReviewed,
          interviews_scheduled: interviewsScheduled,
          offers_made: offersMade,
          avg_response_hours: responseAgg[0]?.avg != null ? Math.round(responseAgg[0].avg * 10) / 10 : null,
        };
      }));
      rows = recruiters.filter(r => r.applications_reviewed > 0 || r.interviews_scheduled > 0 || r.offers_made > 0);

    } else if (type === 'offers') {
      const offerMatch: any = { createdAt: { $gte: start, $lte: end } };
      if (tenantId) offerMatch.companyId = oid(tenantId);
      const agg = await Offer.aggregate([
        { $match: offerMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const total = agg.reduce((s: number, x: any) => s + x.count, 0);
      rows = agg.map((x: any) => ({
        status: x._id,
        count:  x.count,
        percentage_pct: total > 0 ? Math.round((x.count / total) * 100) : 0,
      }));

    } else if (type === 'ai-scores') {
      const scoreMatch: any = { overallScore: { $exists: true, $ne: null }, createdAt: { $gte: start, $lte: end } };
      if (tenantId) scoreMatch.companyId = oid(tenantId);
      const bucketLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-100'];
      const boundaries   = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
      const results = await Application.aggregate([
        { $match: scoreMatch },
        { $bucket: { groupBy: '$overallScore', boundaries: [0,10,20,30,40,50,60,70,80,90,101], default: 'other', output: { count: { $sum: 1 } } } },
      ]);
      rows = boundaries.map((b, i) => {
        const found = results.find((r: any) => r._id === b);
        return { score_range: bucketLabels[i], count: found?.count ?? 0 };
      });

    } else {
      return sendError(res, 'Invalid export type. Valid: funnel, applications, source, time-to-hire, recruiter, offers, ai-scores', 400);
    }

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send('﻿' + csv) as unknown as void; // BOM for Excel UTF-8
  } catch (error: any) {
    logger.error('exportAnalytics error:', error);
    return sendError(res, error.message || 'Failed to export analytics data', 500);
  }
};

// ─── 7. AI Score Distribution ─────────────────────────────────────────────────

/**
 * @desc  Histogram of AI interview overallScore across applications
 * @route GET /api/v1/analytics/ai-score-distribution?startDate=&endDate=
 */
export const getAIScoreDistribution = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    const match: any = {
      overallScore: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    if (tenantId) match.companyId = oid(tenantId);

    // Bucket scores into 10-point ranges: 0-10, 10-20, ..., 90-100
    const pipeline = [
      { $match: match },
      {
        $bucket: {
          groupBy: '$overallScore',
          boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ];

    const results = await Application.aggregate(pipeline);

    // Build histogram data
    const bucketLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
    const boundaries   = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    const histogram = boundaries.map((b, i) => {
      const found = results.find((r: any) => r._id === b);
      return {
        range: bucketLabels[i],
        count: found?.count ?? 0,
      };
    });

    // Stats
    const statsAgg = await Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avg:    { $avg: '$overallScore' },
          median: { $avg: '$overallScore' }, // approximate
          min:    { $min: '$overallScore' },
          max:    { $max: '$overallScore' },
          total:  { $sum: 1 },
        },
      },
    ]);

    const stats = statsAgg[0] ?? { avg: 0, min: 0, max: 0, total: 0 };

    return sendSuccess(res, {
      histogram,
      stats: {
        average: Math.round((stats.avg ?? 0) * 10) / 10,
        min: stats.min ?? 0,
        max: stats.max ?? 0,
        total: stats.total ?? 0,
      },
    }, 'AI score distribution retrieved');
  } catch (error: any) {
    logger.error('getAIScoreDistribution error:', error);
    return sendError(res, error.message || 'Failed to retrieve AI score data', 500);
  }
};

/** Radar chart: average AI interview scores by 5 dimensions for analytics overview */
export const getScoreRadar = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const tenantId = getTenantCompanyId(req.user);
    const { start, end } = parseDates(req);

    // AI interview dimensions: technical, communication, confidence
    const aiMatch: any = {
      'analysis': { $exists: true, $ne: null },
      'status': 'completed',
      'createdAt': { $gte: start, $lte: end },
    };
    if (tenantId) aiMatch.companyId = oid(tenantId);

    const aiAgg = await AIInterviewSession.aggregate([
      { $match: aiMatch },
      {
        $group: {
          _id: null,
          avgTechnical:     { $avg: '$analysis.technicalScore' },
          avgCommunication: { $avg: '$analysis.communicationScore' },
          avgConfidence:    { $avg: '$analysis.confidenceScore' },
          count:            { $sum: 1 },
        },
      },
    ]);

    // Application dimensions: skill match (problem solving proxy) + overall fit (cultural fit proxy)
    const appMatch: any = {
      skillMatchScore:      { $exists: true, $ne: null },
      overallScore:         { $exists: true, $ne: null },
      createdAt:            { $gte: start, $lte: end },
      deletedAt:            null,
    };
    if (tenantId) appMatch.companyId = oid(tenantId);

    const appAgg = await Application.aggregate([
      { $match: appMatch },
      {
        $group: {
          _id: null,
          avgSkillMatch: { $avg: '$skillMatchScore' },
          avgOverall:    { $avg: '$overallScore' },
        },
      },
    ]);

    const aiRow  = aiAgg[0];
    const appRow = appAgg[0];
    const round1 = (v: number | undefined) => Math.round((v ?? 0) * 10) / 10;

    return sendSuccess(res, {
      scores: {
        technical:      round1(aiRow?.avgTechnical),
        communication:  round1(aiRow?.avgCommunication),
        confidence:     round1(aiRow?.avgConfidence),
        problemSolving: round1(appRow?.avgSkillMatch),
        culturalFit:    round1(appRow?.avgOverall),
      },
      count: aiRow?.count ?? 0,
    }, 'Score radar retrieved');
  } catch (error: any) {
    logger.error('getScoreRadar error:', error);
    return sendError(res, error.message || 'Failed to retrieve score radar', 500);
  }
};
