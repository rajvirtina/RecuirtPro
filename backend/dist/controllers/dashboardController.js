"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReport = exports.getRecruitmentAnalytics = exports.getCandidateDashboard = exports.getEmployerDashboard = void 0;
const types_1 = require("../types");
const response_1 = require("../utils/response");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Get employer dashboard statistics
 * @route   GET /api/v1/dashboard/employer
 * @access  Private (Employer/HR/Admin)
 */
const getEmployerDashboard = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        // TENANT ISOLATION: Only super admin gets global view
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        // Build query filter
        const jobFilter = { deletedAt: null };
        const applicationFilter = {};
        const interviewFilter = {};
        if (tenantId) {
            jobFilter.companyId = tenantId;
        }
        // PERF-02: Replace 21 sequential countDocuments with aggregation pipelines
        // Get job IDs first (needed for application/interview filters)
        const jobs = await models_1.Job.find(jobFilter, '_id');
        const jobIds = jobs.map((j) => j._id);
        if (jobIds.length > 0) {
            applicationFilter.jobId = { $in: jobIds };
            interviewFilter.jobId = { $in: jobIds };
        }
        // Single aggregation for job stats by status
        const [jobStats, appStats, interviewStats] = await Promise.all([
            models_1.Job.aggregate([
                { $match: jobFilter },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
            jobIds.length > 0
                ? models_1.Application.aggregate([
                    { $match: applicationFilter },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ])
                : Promise.resolve([]),
            jobIds.length > 0
                ? models_1.Interview.aggregate([
                    { $match: interviewFilter },
                    {
                        $facet: {
                            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                            scheduled: [
                                {
                                    $match: {
                                        status: types_1.InterviewStatus.SCHEDULED,
                                        scheduledTime: { $gte: new Date() },
                                    },
                                },
                                { $count: 'count' },
                            ],
                        },
                    },
                ])
                : Promise.resolve([{ byStatus: [], scheduled: [] }]),
        ]);
        // Extract job counts from aggregation
        const jobCountMap = {};
        jobStats.forEach((s) => { jobCountMap[s._id] = s.count; });
        const totalJobs = Object.values(jobCountMap).reduce((a, b) => a + b, 0);
        const activeJobs = jobCountMap[types_1.JobStatus.PUBLISHED] || 0;
        const draftJobs = jobCountMap[types_1.JobStatus.DRAFT] || 0;
        const closedJobs = jobCountMap[types_1.JobStatus.CLOSED] || 0;
        // Extract application counts
        const appCountMap = {};
        appStats.forEach((s) => { appCountMap[s._id] = s.count; });
        const totalApplications = Object.values(appCountMap).reduce((a, b) => a + b, 0);
        const pendingApplications = appCountMap[types_1.ApplicationStatus.APPLIED] || 0;
        const reviewedApplications = appCountMap[types_1.ApplicationStatus.IN_PROGRESS] || 0;
        const shortlistedApplications = appCountMap[types_1.ApplicationStatus.SHORTLISTED] || 0;
        const selectedApplications = appCountMap[types_1.ApplicationStatus.SELECTED] || 0;
        // Extract interview counts
        const interviewData = interviewStats[0] || { byStatus: [], scheduled: [] };
        const intCountMap = {};
        (interviewData.byStatus || []).forEach((s) => { intCountMap[s._id] = s.count; });
        const totalInterviews = Object.values(intCountMap).reduce((a, b) => a + b, 0);
        const scheduledInterviews = interviewData.scheduled?.[0]?.count || 0;
        const completedInterviews = intCountMap[types_1.InterviewStatus.COMPLETED] || 0;
        const upcomingInterviews = await models_1.Interview.find({
            ...interviewFilter,
            status: { $in: [types_1.InterviewStatus.SCHEDULED, types_1.InterviewStatus.CONFIRMED] },
            scheduledTime: { $gte: new Date() },
        })
            .limit(5)
            .sort({ scheduledTime: 1 })
            .populate('candidateId', 'firstName lastName email')
            .populate('jobId', 'title');
        // Recent applications
        const recentApplications = await models_1.Application.find(applicationFilter)
            .limit(10)
            .sort({ createdAt: -1 })
            .populate('candidateId', 'firstName lastName email')
            .populate('jobId', 'title');
        // Top performing jobs (by application count)
        const topJobs = await models_1.Application.aggregate([
            { $match: applicationFilter },
            { $group: { _id: '$jobId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'jobs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'job',
                },
            },
            { $unwind: '$job' },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    title: '$job.title',
                    status: '$job.status',
                },
            },
        ]);
        // Applications by status (for chart)
        const applicationsByStatus = await models_1.Application.aggregate([
            { $match: applicationFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { status: '$_id', count: 1, _id: 0 } },
        ]);
        // Applications trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const applicationsTrend = await models_1.Application.aggregate([
            {
                $match: {
                    ...applicationFilter,
                    createdAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        // Interviews by status
        const interviewsByStatus = await models_1.Interview.aggregate([
            { $match: interviewFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { status: '$_id', count: 1, _id: 0 } },
        ]);
        // Calculate conversion rates
        const conversionRate = {
            applicationToShortlist: totalApplications > 0
                ? Math.round((shortlistedApplications / totalApplications) * 100)
                : 0,
            shortlistToInterview: shortlistedApplications > 0
                ? Math.round((totalInterviews / shortlistedApplications) * 100)
                : 0,
            interviewToSelection: totalInterviews > 0
                ? Math.round((selectedApplications / totalInterviews) * 100)
                : 0,
            overallConversion: totalApplications > 0
                ? Math.round((selectedApplications / totalApplications) * 100)
                : 0,
        };
        const dashboardData = {
            overview: {
                totalJobs,
                activeJobs,
                draftJobs,
                closedJobs,
                totalApplications,
                pendingApplications,
                reviewedApplications,
                shortlistedApplications,
                selectedApplications,
                totalInterviews,
                scheduledInterviews,
                completedInterviews,
            },
            conversionRate,
            recentApplications,
            upcomingInterviews,
            topJobs,
            charts: {
                applicationsByStatus,
                applicationsTrend,
                interviewsByStatus,
            },
        };
        return (0, response_1.sendSuccess)(res, dashboardData, 'Dashboard data retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getEmployerDashboard:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching dashboard data', 500);
    }
};
exports.getEmployerDashboard = getEmployerDashboard;
/**
 * @desc    Get candidate dashboard statistics
 * @route   GET /api/v1/dashboard/candidate
 * @access  Private (Candidate)
 */
const getCandidateDashboard = async (req, res) => {
    try {
        const candidateId = req.user?._id;
        // PERF-02: Replace sequential countDocuments with aggregation
        const [appStats, intStats] = await Promise.all([
            models_1.Application.aggregate([
                { $match: { candidateId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            models_1.Interview.aggregate([
                { $match: { candidateId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);
        const appMap = {};
        appStats.forEach((s) => { appMap[s._id] = s.count; });
        const totalApplications = Object.values(appMap).reduce((a, b) => a + b, 0);
        const pendingApplications = appMap[types_1.ApplicationStatus.APPLIED] || 0;
        const underReviewApplications = appMap[types_1.ApplicationStatus.IN_PROGRESS] || 0;
        const shortlistedApplications = appMap[types_1.ApplicationStatus.SHORTLISTED] || 0;
        const rejectedApplications = appMap[types_1.ApplicationStatus.REJECTED] || 0;
        const intMap = {};
        intStats.forEach((s) => { intMap[s._id] = s.count; });
        const totalInterviews = Object.values(intMap).reduce((a, b) => a + b, 0);
        const completedInterviews = intMap[types_1.InterviewStatus.COMPLETED] || 0;
        const upcomingInterviews = await models_1.Interview.find({
            candidateId,
            status: { $in: [types_1.InterviewStatus.SCHEDULED, types_1.InterviewStatus.CONFIRMED] },
            scheduledTime: { $gte: new Date() },
        })
            .sort({ scheduledTime: 1 })
            .populate('jobId', 'title location workMode')
            .populate('companyId', 'name');
        // Recent applications
        const recentApplications = await models_1.Application.find({ candidateId })
            .limit(10)
            .sort({ createdAt: -1 })
            .populate('jobId', 'title location workMode salary Min salaryMax currency');
        // Application status breakdown (reuse aggregation data)
        const applicationsByStatus = appStats.map((s) => ({ status: s._id, count: s.count }));
        // Recommended jobs (based on candidate's applications)
        let recommendedJobs = [];
        // Get jobs matching candidate's previous applications
        const appliedJobIds = recentApplications.map(app => app.jobId);
        if (appliedJobIds.length > 0) {
            // Find similar jobs (same company or similar criteria)
            recommendedJobs = await models_1.Job.find({
                status: types_1.JobStatus.PUBLISHED,
                deletedAt: null,
                _id: { $nin: appliedJobIds }, // Exclude already applied jobs
            })
                .limit(5)
                .select('title location workMode skills experienceMin experienceMax salaryMin salaryMax');
        }
        const dashboardData = {
            overview: {
                totalApplications,
                pendingApplications,
                underReviewApplications,
                shortlistedApplications,
                rejectedApplications,
                totalInterviews,
                upcomingInterviews: upcomingInterviews.length,
                completedInterviews,
            },
            upcomingInterviews,
            recentApplications,
            applicationsByStatus,
            recommendedJobs,
        };
        return (0, response_1.sendSuccess)(res, dashboardData, 'Dashboard data retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getCandidateDashboard:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching dashboard data', 500);
    }
};
exports.getCandidateDashboard = getCandidateDashboard;
/**
 * @desc    Get recruitment analytics
 * @route   GET /api/v1/dashboard/analytics
 * @access  Private (Employer/HR/Admin)
 */
const getRecruitmentAnalytics = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { startDate, endDate } = req.query;
        // TENANT ISOLATION: Only super admin gets global view
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        // Build date filter
        const dateFilter = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate);
        }
        // Build query filter
        const jobFilter = { deletedAt: null };
        if (tenantId) {
            jobFilter.companyId = tenantId;
        }
        if (Object.keys(dateFilter).length > 0) {
            jobFilter.createdAt = dateFilter;
        }
        // Get job IDs
        const jobs = await models_1.Job.find(jobFilter, '_id');
        const jobIds = jobs.map((j) => j._id);
        const applicationFilter = jobIds.length > 0 ? { jobId: { $in: jobIds } } : {};
        const interviewFilter = jobIds.length > 0 ? { jobId: { $in: jobIds } } : {};
        // Time to hire (average days from application to selection)
        const timeToHireData = await models_1.Application.aggregate([
            {
                $match: {
                    ...applicationFilter,
                    status: types_1.ApplicationStatus.SELECTED,
                    selectionDate: { $exists: true },
                },
            },
            {
                $project: {
                    daysToHire: {
                        $divide: [
                            { $subtract: ['$selectionDate', '$createdAt'] },
                            1000 * 60 * 60 * 24,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgTimeToHire: { $avg: '$daysToHire' },
                    minTimeToHire: { $min: '$daysToHire' },
                    maxTimeToHire: { $max: '$daysToHire' },
                },
            },
        ]);
        // Source of applications
        const sourceAnalytics = await models_1.Application.aggregate([
            { $match: applicationFilter },
            { $group: { _id: '$source', count: { $sum: 1 } } },
            { $project: { source: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } },
        ]);
        // Top skills in demand
        const topSkills = await models_1.Job.aggregate([
            { $match: jobFilter },
            { $unwind: '$skills' },
            { $group: { _id: '$skills', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { skill: '$_id', count: 1, _id: 0 } },
        ]);
        // Interview completion rate
        const interviewStats = await models_1.Interview.aggregate([
            { $match: interviewFilter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);
        const totalScheduled = interviewStats.reduce((sum, stat) => sum + stat.count, 0);
        const completed = interviewStats.find((s) => s._id === types_1.InterviewStatus.COMPLETED)?.count || 0;
        const interviewCompletionRate = totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100) : 0;
        // Proctoring violations summary — TENANT ISOLATION
        const proctoringFilter = { severity: { $in: ['critical', 'high'] } };
        if (tenantId) {
            proctoringFilter.companyId = tenantId;
        }
        const proctoringViolations = await models_1.ProctoringEvent.aggregate([
            { $match: proctoringFilter },
            { $group: { _id: '$eventType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { eventType: '$_id', count: 1, _id: 0 } },
        ]);
        // Department-wise hiring
        const departmentHiring = await models_1.Job.aggregate([
            { $match: jobFilter },
            {
                $group: {
                    _id: '$department',
                    jobsPosted: { $sum: 1 },
                    totalPositions: { $sum: '$positions' },
                },
            },
            { $sort: { jobsPosted: -1 } },
        ]);
        const analytics = {
            timeToHire: timeToHireData[0] || {
                avgTimeToHire: 0,
                minTimeToHire: 0,
                maxTimeToHire: 0,
            },
            sourceAnalytics,
            topSkills,
            interviewCompletionRate,
            proctoringViolations,
            departmentHiring,
        };
        return (0, response_1.sendSuccess)(res, analytics, 'Analytics retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getRecruitmentAnalytics:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching analytics', 500);
    }
};
exports.getRecruitmentAnalytics = getRecruitmentAnalytics;
/**
 * @desc    Export recruitment report
 * @route   GET /api/v1/dashboard/export
 * @access  Private (Employer/HR/Admin)
 */
const exportReport = async (req, res) => {
    try {
        const { format = 'json', reportType = 'summary' } = req.query;
        const companyId = req.user?.companyId;
        // TENANT ISOLATION: Only super admin gets global view
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        // Build query filter
        const jobFilter = { deletedAt: null };
        if (tenantId) {
            jobFilter.companyId = tenantId;
        }
        let reportData = {};
        if (reportType === 'summary') {
            // Summary report
            const jobs = await models_1.Job.find(jobFilter);
            const jobIds = jobs.map((j) => j._id);
            const applications = await models_1.Application.countDocuments({
                jobId: { $in: jobIds },
            });
            const interviews = await models_1.Interview.countDocuments({ jobId: { $in: jobIds } });
            reportData = {
                reportType: 'Summary Report',
                generatedAt: new Date(),
                totalJobs: jobs.length,
                totalApplications: applications,
                totalInterviews: interviews,
                jobs: jobs.map((j) => ({
                    title: j.title,
                    status: j.status,
                    location: j.location,
                    applications: j.applicationCount,
                    createdAt: j.createdAt,
                })),
            };
        }
        else if (reportType === 'detailed') {
            // Detailed report with all data
            const jobs = await models_1.Job.find(jobFilter).populate('createdBy', 'firstName lastName');
            const jobIds = jobs.map((j) => j._id);
            const applications = await models_1.Application.find({ jobId: { $in: jobIds } })
                .populate('candidateId', 'firstName lastName email')
                .populate('jobId', 'title');
            const interviews = await models_1.Interview.find({ jobId: { $in: jobIds } })
                .populate('candidateId', 'firstName lastName email')
                .populate('jobId', 'title');
            reportData = {
                reportType: 'Detailed Report',
                generatedAt: new Date(),
                jobs,
                applications,
                interviews,
            };
        }
        if (format === 'csv') {
            // For CSV format, you would need to implement CSV generation
            // Using a library like json2csv
            return (0, response_1.sendSuccess)(res, { message: 'CSV export not yet implemented' }, 'CSV export coming soon');
        }
        return (0, response_1.sendSuccess)(res, reportData, 'Report generated successfully');
    }
    catch (error) {
        logger_1.default.error('Error in exportReport:', error);
        return (0, response_1.sendError)(res, error.message || 'Error exporting report', 500);
    }
};
exports.exportReport = exportReport;
//# sourceMappingURL=dashboardController.js.map