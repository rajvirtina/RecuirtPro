"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJob = exports.updateJob = exports.createJob = exports.getJobById = exports.getJobsByCompanySlug = exports.getCompanyInfoBySlug = exports.getJobs = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const auth_1 = require("../middleware/auth");
const getJobs = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, companySpecific } = req.query;
        const query = { deletedAt: null };
        // TENANT ISOLATION: Always scope by company for non-super-admin users
        const userRole = req.user?.role;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            query.companyId = new mongoose_1.default.Types.ObjectId(tenantId);
            logger_1.default.info(`[getJobs] ✅ Applying company filter: ${tenantId}`);
        }
        else if ((0, auth_1.isSuperAdmin)(req.user)) {
            // Super admin: optionally filter by company
            if (companySpecific === 'true' && req.user?.companyId) {
                query.companyId = new mongoose_1.default.Types.ObjectId(req.user.companyId);
            }
            logger_1.default.info(`[getJobs] Super admin - ${companySpecific === 'true' ? 'filtered' : 'global'} view`);
        }
        else if (userRole === 'candidate') {
            // Candidates without a company affiliation see no jobs —
            // all candidates are required to register under a specific company.
            query._id = null;
            logger_1.default.info(`[getJobs] Candidate without companyId - returning empty result`);
        }
        else {
            logger_1.default.info(`[getJobs] ❌ NO company filter applied - Role: ${userRole}, HasCompanyId: ${!!req.user?.companyId}`);
        }
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const skip = (pageNum - 1) * limitNum;
        // Single query using $facet to avoid separate countDocuments scan (PERF)
        const pipeline = [{ $match: query }];
        const facetResult = await models_1.Job.aggregate([
            ...pipeline,
            {
                $facet: {
                    data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limitNum }],
                    totalCount: [{ $count: 'count' }],
                },
            },
        ]);
        const jobIds = facetResult[0]?.data?.map((j) => j._id) || [];
        const total = facetResult[0]?.totalCount?.[0]?.count || 0;
        // Populate after aggregation
        const jobs = await models_1.Job.find({ _id: { $in: jobIds } })
            .populate('companyId', 'name logo slug')
            .sort({ createdAt: -1 });
        logger_1.default.info(`Found ${total} jobs matching query. Returning ${jobs.length} jobs for page ${pageNum}`);
        (0, response_1.sendPaginatedResponse)(res, jobs, pageNum, limitNum, total, "Jobs retrieved");
    }
    catch (error) {
        next(error);
    }
};
exports.getJobs = getJobs;
const getCompanyInfoBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const company = await models_1.Company.findOne({ slug: slug.toLowerCase(), deletedAt: null, status: 'active' });
        if (!company) {
            (0, response_1.sendError)(res, 'Company not found', 404);
            return;
        }
        (0, response_1.sendSuccess)(res, { name: company.name, slug: company.slug, logo: company.logo }, 'Company found');
    }
    catch (error) {
        next(error);
    }
};
exports.getCompanyInfoBySlug = getCompanyInfoBySlug;
const getJobsByCompanySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { page = 1, limit = 10 } = req.query;
        // Find company by slug
        const company = await models_1.Company.findOne({ slug, deletedAt: null });
        if (!company) {
            (0, response_1.sendError)(res, "Company not found", 404);
            return;
        }
        // Build query for jobs belonging to this company — public endpoint, only published jobs
        const query = {
            companyId: company._id,
            deletedAt: null,
            status: 'published'
        };
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const skip = (pageNum - 1) * limitNum;
        const jobs = await models_1.Job.find(query)
            .populate('companyId', 'name logo slug description website')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);
        const total = await models_1.Job.countDocuments(query);
        (0, response_1.sendPaginatedResponse)(res, jobs, pageNum, limitNum, total, `Jobs retrieved for ${company.name}`);
    }
    catch (error) {
        next(error);
    }
};
exports.getJobsByCompanySlug = getJobsByCompanySlug;
const getJobById = async (req, res, next) => {
    try {
        const job = await models_1.Job.findById(req.params.id).populate('companyId', 'name logo slug description website');
        if (!job) {
            (0, response_1.sendError)(res, "Job not found", 404);
            return;
        }
        // Authorization: All non-super-admin users can only view their company's jobs
        const userRole = req.user?.role;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            const jobCompanyId = job.companyId._id.toString();
            if (jobCompanyId !== tenantId) {
                logger_1.default.warn(`[getJobById] Access denied: ${req.user?.email} (${tenantId}) tried to access job from company ${jobCompanyId}`);
                (0, response_1.sendError)(res, "You don't have permission to view this job", 403);
                return;
            }
        }
        (0, response_1.sendSuccess)(res, { job }, "Job retrieved");
    }
    catch (error) {
        next(error);
    }
};
exports.getJobById = getJobById;
const createJob = async (req, res, next) => {
    try {
        // If companyId is not provided, use the user's companyId
        let companyId = req.user?.companyId;
        // SECURITY: Only super admin can specify a different companyId
        if (req.body.companyId && (0, auth_1.isSuperAdmin)(req.user)) {
            companyId = req.body.companyId;
        }
        // If still no companyId, check if user has one or create error
        if (!companyId) {
            (0, response_1.sendError)(res, 'Company ID is required. Please update your profile with company information.', 400);
            return;
        }
        // Whitelist allowed fields to prevent mass assignment (SEC-03/B-02)
        const allowedFields = [
            'title', 'description', 'responsibilities', 'requirements', 'skills',
            'experienceMin', 'experienceMax', 'salaryMin', 'salaryMax', 'currency',
            'location', 'workMode', 'jobType', 'department', 'positions',
            'joiningDate', 'expiryDate', 'tags',
        ];
        const jobData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                jobData[field] = req.body[field];
            }
        }
        jobData.companyId = companyId;
        jobData.createdBy = req.user?._id;
        jobData.status = types_1.JobStatus.DRAFT; // New jobs always start as draft
        // VAL-003: Strip empty/blank skill strings before persisting
        if (Array.isArray(jobData.skills)) {
            jobData.skills = jobData.skills
                .map((s) => (typeof s === 'string' ? s.trim() : s))
                .filter((s) => s.length > 0);
        }
        // Cross-field validation (EC-01/EC-02)
        if (jobData.experienceMin != null && jobData.experienceMax != null && jobData.experienceMin > jobData.experienceMax) {
            (0, response_1.sendError)(res, 'experienceMin cannot be greater than experienceMax', 400);
            return;
        }
        if (jobData.salaryMin != null && jobData.salaryMax != null && jobData.salaryMin > jobData.salaryMax) {
            (0, response_1.sendError)(res, 'salaryMin cannot be greater than salaryMax', 400);
            return;
        }
        const job = await models_1.Job.create(jobData);
        (0, response_1.sendSuccess)(res, { job }, "Job created", 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createJob = createJob;
const updateJob = async (req, res, next) => {
    try {
        const job = await models_1.Job.findById(req.params.id);
        if (!job) {
            (0, response_1.sendError)(res, "Job not found", 404);
            return;
        }
        // Authorization: ALL roles must have matching companyId for updates (SEC-05/B-04)
        const userRole = req.user?.role;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            if (job.companyId.toString() !== tenantId) {
                logger_1.default.warn(`[updateJob] Access denied: ${req.user?.email} tried to update job from another company`);
                (0, response_1.sendError)(res, "You don't have permission to update this job", 403);
                return;
            }
        }
        // Whitelist allowed update fields to prevent mass assignment (SEC-03/B-02)
        const allowedUpdateFields = [
            'title', 'description', 'responsibilities', 'requirements', 'skills',
            'experienceMin', 'experienceMax', 'salaryMin', 'salaryMax', 'currency',
            'location', 'workMode', 'jobType', 'status', 'department', 'positions',
            'joiningDate', 'expiryDate', 'tags',
        ];
        const sanitizedUpdate = {};
        for (const field of allowedUpdateFields) {
            if (req.body[field] !== undefined) {
                sanitizedUpdate[field] = req.body[field];
            }
        }
        // Cross-field validation (EC-01/EC-02)
        const checkExpMin = sanitizedUpdate.experienceMin ?? job.experienceMin;
        const checkExpMax = sanitizedUpdate.experienceMax ?? job.experienceMax;
        if (checkExpMin != null && checkExpMax != null && checkExpMin > checkExpMax) {
            (0, response_1.sendError)(res, 'experienceMin cannot be greater than experienceMax', 400);
            return;
        }
        const checkSalMin = sanitizedUpdate.salaryMin ?? job.salaryMin;
        const checkSalMax = sanitizedUpdate.salaryMax ?? job.salaryMax;
        if (checkSalMin != null && checkSalMax != null && checkSalMin > checkSalMax) {
            (0, response_1.sendError)(res, 'salaryMin cannot be greater than salaryMax', 400);
            return;
        }
        const updatedJob = await models_1.Job.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });
        (0, response_1.sendSuccess)(res, { job: updatedJob }, "Job updated");
    }
    catch (error) {
        next(error);
    }
};
exports.updateJob = updateJob;
const deleteJob = async (req, res, next) => {
    try {
        const job = await models_1.Job.findById(req.params.id);
        if (!job) {
            (0, response_1.sendError)(res, "Job not found", 404);
            return;
        }
        // Authorization: ALL roles must have matching companyId for deletes (SEC-05/B-04)
        const userRole = req.user?.role;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            if (job.companyId.toString() !== tenantId) {
                logger_1.default.warn(`[deleteJob] Access denied: ${req.user?.email} tried to delete job from another company`);
                (0, response_1.sendError)(res, "You don't have permission to delete this job", 403);
                return;
            }
        }
        job.deletedAt = new Date();
        await job.save();
        (0, response_1.sendSuccess)(res, null, "Job deleted");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteJob = deleteJob;
//# sourceMappingURL=jobController.js.map