import { Response } from 'express';
import mongoose from 'mongoose';
import { Application } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';
import { getTenantCompanyId, isSuperAdmin } from '../middleware/auth';
import logger from '../utils/logger';

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
export const getPipeline = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.query as { jobId?: string };
    const limit = Math.min(parseInt((req.query.limit as string) || '200', 10), 500);

    // Build match filter
    const match: Record<string, any> = { deletedAt: null };

    // Tenant isolation — always scope to company
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      match.companyId = new mongoose.Types.ObjectId(tenantId);
    } else if (!isSuperAdmin(req.user)) {
      return sendError(res, 'Company context required', 400);
    }

    if (jobId) {
      if (!mongoose.isValidObjectId(jobId)) {
        return sendError(res, 'Invalid jobId', 400);
      }
      match.jobId = new mongoose.Types.ObjectId(jobId);
    }

    // Aggregate: group by status, populate candidate + job basics
    const grouped = await Application.aggregate([
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
          _id:        '$status',
          candidates: { $push: '$$ROOT' },
          count:      { $sum: 1 },
        },
      },
    ]);

    // Shape into a stage-keyed object so frontend can access by stage id directly
    const result: Record<string, { candidates: any[]; count: number }> = {};

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

    logger.info(
      `[getPipeline] company=${tenantId || 'super'} jobId=${jobId || 'all'} total=${totalCandidates}`
    );

    return sendSuccess(res, { pipeline: result, totalCandidates, stages: PIPELINE_STAGES }, 'Pipeline retrieved');
  } catch (error: any) {
    logger.error('Error in getPipeline:', error);
    return sendError(res, error.message || 'Failed to retrieve pipeline', 500);
  }
};
