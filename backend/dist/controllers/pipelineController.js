"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPipeline = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
// All valid pipeline stages in display order
const PIPELINE_STAGES = [
    'applied',
    'shortlisted',
    'interview_scheduled',
    'in_progress',
    'selected',
    'offer_released',
    'hired',
    'on_hold',
    'rejected',
    'withdrawn',
];
/**
 * @desc    Get pipeline — applications grouped by status
 * @route   GET /api/v1/pipeline?jobId=<optional>
 * @access  Private (HR / Employer / Admin / Interviewer)
 */
const getPipeline = async (req, res) => {
    try {
        const { jobId } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
        // Build match filter
        const match = { deletedAt: null };
        // Tenant isolation — always scope to company
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            match.companyId = new mongoose_1.default.Types.ObjectId(tenantId);
        }
        else if (!(0, auth_1.isSuperAdmin)(req.user)) {
            return (0, response_1.sendError)(res, 'Company context required', 400);
        }
        if (jobId) {
            if (!mongoose_1.default.isValidObjectId(jobId)) {
                return (0, response_1.sendError)(res, 'Invalid jobId', 400);
            }
            match.jobId = new mongoose_1.default.Types.ObjectId(jobId);
        }
        // Aggregate: group by status, populate candidate + job basics
        const grouped = await models_1.Application.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'candidateId',
                    foreignField: '_id',
                    as: 'candidateId',
                    pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
                },
            },
            { $unwind: { path: '$candidateId', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'jobId',
                    foreignField: '_id',
                    as: 'jobId',
                    pipeline: [{ $project: { title: 1, location: 1, department: 1 } }],
                },
            },
            { $unwind: { path: '$jobId', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$status',
                    candidates: { $push: '$$ROOT' },
                    count: { $sum: 1 },
                },
            },
        ]);
        // Shape into a stage-keyed object so frontend can access by stage id directly
        const result = {};
        // Initialise all stages with empty arrays
        for (const stage of PIPELINE_STAGES) {
            result[stage] = { candidates: [], count: 0 };
        }
        // Fill from aggregation result
        for (const group of grouped) {
            if (result[group._id]) {
                result[group._id] = { candidates: group.candidates, count: group.count };
            }
        }
        const totalCandidates = grouped.reduce((sum, g) => sum + g.count, 0);
        logger_1.default.info(`[getPipeline] company=${tenantId || 'super'} jobId=${jobId || 'all'} total=${totalCandidates}`);
        return (0, response_1.sendSuccess)(res, { pipeline: result, totalCandidates, stages: PIPELINE_STAGES }, 'Pipeline retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getPipeline:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to retrieve pipeline', 500);
    }
};
exports.getPipeline = getPipeline;
//# sourceMappingURL=pipelineController.js.map