"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIScoreDistribution = exports.getOfferRate = exports.getRecruiterProductivity = exports.getTimeToHire = exports.getSourceBreakdown = exports.getApplicationsOverTime = exports.getFunnel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDates(req) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = req.query.startDate
        ? new Date(req.query.startDate)
        : thirtyDaysAgo;
    const end = req.query.endDate
        ? new Date(req.query.endDate)
        : now;
    // Clamp end to end-of-day
    end.setHours(23, 59, 59, 999);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    }
    return { start, end };
}
function oid(id) {
    if (!id)
        return null;
    try {
        return new mongoose_1.default.Types.ObjectId(id);
    }
    catch {
        return null;
    }
}
function convRate(num, denom) {
    return denom > 0 ? Math.round((num / denom) * 100) : 0;
}
// ─── 1. Conversion Funnel ─────────────────────────────────────────────────────
/**
 * @desc  Conversion funnel: Applied → Shortlisted → Interviewed → Offer Sent → Hired
 * @route GET /api/v1/analytics/funnel?startDate=&endDate=
 */
const getFunnel = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const { start, end } = parseDates(req);
        const baseMatch = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
        if (tenantId)
            baseMatch.companyId = oid(tenantId);
        const statusCounts = await models_1.Application.aggregate([
            { $match: baseMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const counts = {};
        statusCounts.forEach(({ _id, count }) => { counts[_id] = count; });
        // Cumulative funnel: each stage includes all downstream stages
        const ALL_STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released', 'rejected', 'on_hold', 'withdrawn'];
        const SHORTLISTED_UP = ['shortlisted', 'interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released'];
        const INTERVIEWED_UP = ['interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released'];
        const OFFER_UP = ['offer_released', 'hired'];
        const sum = (statuses) => statuses.reduce((s, k) => s + (counts[k] ?? 0), 0);
        const applied = sum(ALL_STATUSES);
        const shortlisted = sum(SHORTLISTED_UP);
        const interviewed = sum(INTERVIEWED_UP);
        const offerSent = sum(OFFER_UP);
        const hired = counts['hired'] ?? 0;
        const funnel = [
            { stage: 'Applied', count: applied, conversionRate: 100 },
            { stage: 'Shortlisted', count: shortlisted, conversionRate: convRate(shortlisted, applied) },
            { stage: 'Interviewed', count: interviewed, conversionRate: convRate(interviewed, shortlisted) },
            { stage: 'Offer Sent', count: offerSent, conversionRate: convRate(offerSent, interviewed) },
            { stage: 'Hired', count: hired, conversionRate: convRate(hired, offerSent) },
        ];
        return (0, response_1.sendSuccess)(res, {
            funnel,
            summary: {
                totalApplications: applied,
                hired,
                overallConversionRate: convRate(hired, applied),
                shortlisted,
                interviewed,
            },
        }, 'Funnel data retrieved');
    }
    catch (error) {
        logger_1.default.error('getFunnel error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve funnel data', 500);
    }
};
exports.getFunnel = getFunnel;
// ─── 2. Applications Over Time ───────────────────────────────────────────────
/**
 * @desc  Daily application count (total + AI-qualified)
 * @route GET /api/v1/analytics/applications-over-time?period=30d  OR  ?startDate=&endDate=
 */
const getApplicationsOverTime = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        // Support period shorthand (30d, 7d, 90d) OR explicit start/end
        let start, end;
        if (req.query.period) {
            const days = parseInt(req.query.period.replace('d', '')) || 30;
            end = new Date();
            end.setHours(23, 59, 59, 999);
            start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        }
        else {
            ({ start, end } = parseDates(req));
        }
        const baseMatch = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
        if (tenantId)
            baseMatch.companyId = oid(tenantId);
        const agg = await models_1.Application.aggregate([
            { $match: baseMatch },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                    },
                    total: { $sum: 1 },
                    qualified: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$overallScore', 0] }, 70] }, 1, 0] } },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]);
        const series = agg.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            total: item.total,
            qualified: item.qualified,
        }));
        return (0, response_1.sendSuccess)(res, { series }, 'Applications over time retrieved');
    }
    catch (error) {
        logger_1.default.error('getApplicationsOverTime error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve time series', 500);
    }
};
exports.getApplicationsOverTime = getApplicationsOverTime;
// ─── 3. Source Breakdown ─────────────────────────────────────────────────────
/**
 * @desc  Application source breakdown (direct, naukri, linkedin, referral, …)
 * @route GET /api/v1/analytics/source-breakdown?startDate=&endDate=
 */
const getSourceBreakdown = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const { start, end } = parseDates(req);
        const baseMatch = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
        if (tenantId)
            baseMatch.companyId = oid(tenantId);
        const agg = await models_1.Application.aggregate([
            { $match: baseMatch },
            { $group: { _id: { $ifNull: ['$source', 'direct'] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        const total = agg.reduce((s, x) => s + x.count, 0);
        const sources = agg.map(x => ({
            source: String(x._id),
            count: x.count,
            percentage: total > 0 ? Math.round((x.count / total) * 100) : 0,
        }));
        return (0, response_1.sendSuccess)(res, { sources, total }, 'Source breakdown retrieved');
    }
    catch (error) {
        logger_1.default.error('getSourceBreakdown error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve source data', 500);
    }
};
exports.getSourceBreakdown = getSourceBreakdown;
// ─── 4. Time to Hire by Department ──────────────────────────────────────────
/**
 * @desc  Average days to hire grouped by job department
 * @route GET /api/v1/analytics/time-to-hire?groupBy=department
 */
const getTimeToHire = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const baseMatch = {
            deletedAt: null,
            status: 'hired',
            hiredAt: { $exists: true, $ne: null },
        };
        if (tenantId)
            baseMatch.companyId = oid(tenantId);
        // Optional date filter on hiredAt
        if (req.query.startDate || req.query.endDate) {
            const { start, end } = parseDates(req);
            baseMatch.hiredAt = { $gte: start, $lte: end };
        }
        const agg = await models_1.Application.aggregate([
            { $match: baseMatch },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'jobId',
                    foreignField: '_id',
                    as: 'job',
                },
            },
            { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$job.department', 'Unspecified'] },
                    avgMs: { $avg: { $subtract: ['$hiredAt', '$appliedAt'] } },
                    count: { $sum: 1 },
                    minDays: { $min: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86400000] } },
                    maxDays: { $max: { $divide: [{ $subtract: ['$hiredAt', '$appliedAt'] }, 86400000] } },
                },
            },
            { $sort: { avgMs: 1 } },
        ]);
        const departments = agg.map(x => ({
            department: x._id,
            avgDays: Math.round((x.avgMs / 86400000) * 10) / 10,
            count: x.count,
            minDays: Math.round(x.minDays * 10) / 10,
            maxDays: Math.round(x.maxDays * 10) / 10,
        }));
        const companyAvg = departments.length > 0
            ? Math.round(departments.reduce((s, d) => s + d.avgDays, 0) / departments.length * 10) / 10
            : 0;
        return (0, response_1.sendSuccess)(res, { departments, companyAvg }, 'Time-to-hire data retrieved');
    }
    catch (error) {
        logger_1.default.error('getTimeToHire error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve time-to-hire data', 500);
    }
};
exports.getTimeToHire = getTimeToHire;
// ─── 5. Recruiter Productivity ────────────────────────────────────────────────
/**
 * @desc  Per-recruiter activity: applications reviewed, interviews, offers, avg response time
 * @route GET /api/v1/analytics/recruiter-productivity?startDate=&endDate=
 */
const getRecruiterProductivity = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const { start, end } = parseDates(req);
        // Find all HR / Employer / Admin users for this company
        const userMatch = {
            role: { $in: ['hr', 'employer', 'admin'] },
            deletedAt: null,
            status: 'active',
        };
        if (tenantId)
            userMatch.companyId = oid(tenantId);
        const hrUsers = await models_1.User.find(userMatch)
            .select('_id firstName lastName email')
            .lean();
        if (hrUsers.length === 0) {
            return (0, response_1.sendSuccess)(res, { recruiters: [] }, 'No HR users found');
        }
        const recruiters = await Promise.all(hrUsers.map(async (u) => {
            const userId = new mongoose_1.default.Types.ObjectId(String(u._id));
            const appBase = { deletedAt: null, createdAt: { $gte: start, $lte: end } };
            if (tenantId)
                appBase.companyId = oid(tenantId);
            const [appsReviewed, interviewsScheduled, offersMade, responseAgg] = await Promise.all([
                // Applications this recruiter touched (any status change by them)
                models_1.Application.countDocuments({ ...appBase, 'statusHistory.changedBy': userId }),
                // Interviews they scheduled
                models_1.Interview.countDocuments({
                    ...(tenantId ? { companyId: oid(tenantId) } : {}),
                    scheduledBy: userId,
                    createdAt: { $gte: start, $lte: end },
                }),
                // Offers they made (status → offer_released)
                models_1.Application.countDocuments({
                    ...(tenantId ? { companyId: oid(tenantId) } : {}),
                    deletedAt: null,
                    statusHistory: {
                        $elemMatch: {
                            status: 'offer_released',
                            changedBy: userId,
                            changedAt: { $gte: start, $lte: end },
                        },
                    },
                }),
                // Average response time (hours from appliedAt to first status change by this user)
                models_1.Application.aggregate([
                    { $match: { ...appBase, 'statusHistory.changedBy': userId } },
                    { $unwind: '$statusHistory' },
                    { $match: { 'statusHistory.changedBy': userId } },
                    { $sort: { 'statusHistory.changedAt': 1 } },
                    { $group: { _id: '$_id', first: { $first: '$statusHistory.changedAt' }, applied: { $first: '$appliedAt' } } },
                    { $project: { hours: { $divide: [{ $subtract: ['$first', '$applied'] }, 3600000] } } },
                    { $group: { _id: null, avg: { $avg: '$hours' } } },
                ]),
            ]);
            return {
                id: String(u._id),
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
                applicationsReviewed: appsReviewed,
                interviewsScheduled,
                offersMade,
                avgResponseTimeHours: responseAgg[0]?.avg != null
                    ? Math.round(responseAgg[0].avg * 10) / 10
                    : null,
            };
        }));
        // Only return users who had at least one activity in range
        const active = recruiters.filter(r => r.applicationsReviewed > 0 || r.interviewsScheduled > 0 || r.offersMade > 0);
        return (0, response_1.sendSuccess)(res, { recruiters: active }, 'Recruiter productivity retrieved');
    }
    catch (error) {
        logger_1.default.error('getRecruiterProductivity error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve recruiter data', 500);
    }
};
exports.getRecruiterProductivity = getRecruiterProductivity;
// ─── 6. Offer Acceptance Rate ─────────────────────────────────────────────────
/**
 * @desc  Offer funnel: sent, accepted, rejected, negotiating, withdrawn
 * @route GET /api/v1/analytics/offer-rate?startDate=&endDate=
 */
const getOfferRate = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const { start, end } = parseDates(req);
        const match = { createdAt: { $gte: start, $lte: end } };
        if (tenantId)
            match.companyId = oid(tenantId);
        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ];
        const results = await models_1.Offer.aggregate(pipeline);
        const statusMap = {};
        results.forEach((r) => { statusMap[r._id] = r.count; });
        const total = Object.values(statusMap).reduce((s, v) => s + v, 0);
        const sent = (statusMap[types_1.OfferStatus.SENT] ?? 0) + (statusMap[types_1.OfferStatus.ACCEPTED] ?? 0) + (statusMap[types_1.OfferStatus.REJECTED] ?? 0) + (statusMap[types_1.OfferStatus.NEGOTIATING] ?? 0);
        const accepted = statusMap[types_1.OfferStatus.ACCEPTED] ?? 0;
        const rejected = statusMap[types_1.OfferStatus.REJECTED] ?? 0;
        const negotiating = statusMap[types_1.OfferStatus.NEGOTIATING] ?? 0;
        const withdrawn = statusMap[types_1.OfferStatus.WITHDRAWN] ?? 0;
        return (0, response_1.sendSuccess)(res, {
            total,
            sent,
            accepted,
            rejected,
            negotiating,
            withdrawn,
            acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
            breakdown: [
                { label: 'Accepted', value: accepted, color: '#22c55e' },
                { label: 'Rejected', value: rejected, color: '#ef4444' },
                { label: 'Negotiating', value: negotiating, color: '#f59e0b' },
                { label: 'Withdrawn', value: withdrawn, color: '#6b7280' },
                { label: 'Pending', value: (statusMap[types_1.OfferStatus.SENT] ?? 0), color: '#3b82f6' },
            ].filter(b => b.value > 0),
        }, 'Offer acceptance rate retrieved');
    }
    catch (error) {
        logger_1.default.error('getOfferRate error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve offer data', 500);
    }
};
exports.getOfferRate = getOfferRate;
// ─── 7. AI Score Distribution ─────────────────────────────────────────────────
/**
 * @desc  Histogram of AI interview overallScore across applications
 * @route GET /api/v1/analytics/ai-score-distribution?startDate=&endDate=
 */
const getAIScoreDistribution = async (req, res) => {
    try {
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const { start, end } = parseDates(req);
        const match = {
            overallScore: { $exists: true, $ne: null },
            createdAt: { $gte: start, $lte: end },
        };
        if (tenantId)
            match.companyId = oid(tenantId);
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
        const results = await models_1.Application.aggregate(pipeline);
        // Build histogram data
        const bucketLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
        const boundaries = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
        const histogram = boundaries.map((b, i) => {
            const found = results.find((r) => r._id === b);
            return {
                range: bucketLabels[i],
                count: found?.count ?? 0,
            };
        });
        // Stats
        const statsAgg = await models_1.Application.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    avg: { $avg: '$overallScore' },
                    median: { $avg: '$overallScore' }, // approximate
                    min: { $min: '$overallScore' },
                    max: { $max: '$overallScore' },
                    total: { $sum: 1 },
                },
            },
        ]);
        const stats = statsAgg[0] ?? { avg: 0, min: 0, max: 0, total: 0 };
        return (0, response_1.sendSuccess)(res, {
            histogram,
            stats: {
                average: Math.round((stats.avg ?? 0) * 10) / 10,
                min: stats.min ?? 0,
                max: stats.max ?? 0,
                total: stats.total ?? 0,
            },
        }, 'AI score distribution retrieved');
    }
    catch (error) {
        logger_1.default.error('getAIScoreDistribution error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve AI score data', 500);
    }
};
exports.getAIScoreDistribution = getAIScoreDistribution;
//# sourceMappingURL=analyticsController.js.map