import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Job, Application, Company } from "../models";
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from "../utils/response";
import logger from "../utils/logger";
import { JobStatus, UserRole, AuthRequest } from "../types";
import { isSuperAdmin, getTenantCompanyId } from "../middleware/auth";
import { triggerPendingPortalPostings } from "../services/jobPortalService";

export const getJobs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, companySpecific } = req.query;
    const query: any = { deletedAt: null };
    
    // TENANT ISOLATION: Always scope by company for non-super-admin users
    const userRole = req.user?.role;
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      query.companyId = new mongoose.Types.ObjectId(tenantId);
      logger.info(`[getJobs] ✅ Applying company filter: ${tenantId}`);
    } else if (isSuperAdmin(req.user)) {
      // Super admin: optionally filter by company
      if (companySpecific === 'true' && req.user?.companyId) {
        query.companyId = new mongoose.Types.ObjectId(req.user.companyId);
      }
      logger.info(`[getJobs] Super admin - ${companySpecific === 'true' ? 'filtered' : 'global'} view`);
    } else if (userRole === 'candidate') {
      // Candidates without a company affiliation see no jobs —
      // all candidates are required to register under a specific company.
      query._id = null;
      logger.info(`[getJobs] Candidate without companyId - returning empty result`);
    } else {
      logger.info(`[getJobs] ❌ NO company filter applied - Role: ${userRole}, HasCompanyId: ${!!req.user?.companyId}`);
    }
    
    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Single query using $facet to avoid separate countDocuments scan (PERF)
    const pipeline: any[] = [{ $match: query }];
    const facetResult = await Job.aggregate([
      ...pipeline,
      {
        $facet: {
          data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limitNum }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const jobIds = facetResult[0]?.data?.map((j: any) => j._id) || [];
    const total = facetResult[0]?.totalCount?.[0]?.count || 0;

    // Populate after aggregation
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .populate('companyId', 'name logo slug')
      .sort({ createdAt: -1 });
    
    logger.info(`Found ${total} jobs matching query. Returning ${jobs.length} jobs for page ${pageNum}`);
    sendPaginatedResponse(res, jobs, pageNum, limitNum, total, "Jobs retrieved");
  } catch (error) { next(error); }
};

export const getCompanyInfoBySlug = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;
    const searchTerm = slug.trim().toLowerCase();
    const company = await Company.findOne({
      $or: [
        { slug: searchTerm },
        { name: { $regex: `^${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { slug: { $regex: `^${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } },
      ],
      deletedAt: null,
      status: { $in: ['active', 'pending_verification'] },
    });
    if (!company) {
      sendError(res, 'Company not found', 404);
      return;
    }
    sendSuccess(res, { name: company.name, slug: company.slug, logo: company.logo }, 'Company found');
  } catch (error) { next(error); }
};

export const getJobsByCompanySlug = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Find company by slug
    const company = await Company.findOne({ slug, deletedAt: null });
    if (!company) {
      sendError(res, "Company not found", 404);
      return;
    }
    
    // Build query for jobs belonging to this company — public endpoint, only published jobs
    const query: any = { 
      companyId: company._id,
      deletedAt: null,
      status: 'published'
    };
    
    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;
    
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo slug description website')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
      
    const total = await Job.countDocuments(query);
    
    sendPaginatedResponse(res, jobs, pageNum, limitNum, total, `Jobs retrieved for ${company.name}`);
  } catch (error) { next(error); }
};

export const getJobById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id).populate('companyId', 'name logo slug description website');
    if (!job) { sendError(res, "Job not found", 404); return; }
    
    // Authorization: All non-super-admin users can only view their company's jobs
    const userRole = req.user?.role;
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      const jobCompanyId = job.companyId._id.toString();
      if (jobCompanyId !== tenantId) {
        logger.warn(`[getJobById] Access denied: ${req.user?.email} (${tenantId}) tried to access job from company ${jobCompanyId}`);
        sendError(res, "You don't have permission to view this job", 403);
        return;
      }
    }
    
    sendSuccess(res, { job }, "Job retrieved");
  } catch (error) { next(error); }
};

export const createJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // If companyId is not provided, use the user's companyId
    let companyId = req.user?.companyId;
    
    // SECURITY: Only super admin can specify a different companyId
    if (req.body.companyId && isSuperAdmin(req.user)) {
      companyId = req.body.companyId;
    }
    
    // If still no companyId, check if user has one or create error
    if (!companyId) {
      sendError(res, 'Company ID is required. Please update your profile with company information.', 400);
      return;
    }

    // Whitelist allowed fields to prevent mass assignment (SEC-03/B-02)
    const allowedFields = [
      'title', 'description', 'responsibilities', 'requirements', 'skills',
      'experienceMin', 'experienceMax', 'salaryMin', 'salaryMax', 'currency',
      'location', 'workMode', 'jobType', 'department', 'positions',
      'joiningDate', 'expiryDate', 'tags',
    ];
    const jobData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        jobData[field] = req.body[field];
      }
    }
    jobData.companyId = companyId;
    jobData.createdBy = req.user?._id;
    // Allow status override only to 'published'; everything else defaults to DRAFT
    const requestedStatus = req.body.status;
    jobData.status = requestedStatus === JobStatus.PUBLISHED ? JobStatus.PUBLISHED : JobStatus.DRAFT;

    // Description required only when publishing
    if (jobData.status === JobStatus.PUBLISHED) {
      const descText = (jobData.description || '').replace(/<[^>]*>/g, '').trim();
      if (!descText || descText.length < 10) {
        sendError(res, 'Job description is required before publishing (at least 10 characters).', 400);
        return;
      }
    }

    // VAL-003: Strip empty/blank skill strings before persisting
    if (Array.isArray(jobData.skills)) {
      jobData.skills = jobData.skills
        .map((s: string) => (typeof s === 'string' ? s.trim() : s))
        .filter((s: string) => s.length > 0);
    }

    // Cross-field validation (EC-01/EC-02)
    if (jobData.experienceMin != null && jobData.experienceMax != null && jobData.experienceMin > jobData.experienceMax) {
      sendError(res, 'experienceMin cannot be greater than experienceMax', 400);
      return;
    }
    if (jobData.salaryMin != null && jobData.salaryMax != null && jobData.salaryMin > jobData.salaryMax) {
      sendError(res, 'salaryMin cannot be greater than salaryMax', 400);
      return;
    }

    const job = await Job.create(jobData);
    sendSuccess(res, { job }, "Job created", 201);
  } catch (error) { 
    next(error); 
  }
};

export const updateJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, "Job not found", 404); return; }
    
    // Authorization: ALL roles must have matching companyId for updates (SEC-05/B-04)
    const userRole = req.user?.role;
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      if (job.companyId.toString() !== tenantId) {
        logger.warn(`[updateJob] Access denied: ${req.user?.email} tried to update job from another company`);
        sendError(res, "You don't have permission to update this job", 403);
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
    const sanitizedUpdate: Record<string, any> = {};
    for (const field of allowedUpdateFields) {
      if (req.body[field] !== undefined) {
        sanitizedUpdate[field] = req.body[field];
      }
    }

    // Description required when publishing
    if (sanitizedUpdate.status === JobStatus.PUBLISHED) {
      const existingDesc = sanitizedUpdate.description ?? (job as any).description ?? '';
      const descText = existingDesc.replace(/<[^>]*>/g, '').trim();
      if (!descText || descText.length < 10) {
        sendError(res, 'Job description is required before publishing (at least 10 characters).', 400);
        return;
      }
    }

    // Cross-field validation (EC-01/EC-02)
    const checkExpMin = sanitizedUpdate.experienceMin ?? (job as any).experienceMin;
    const checkExpMax = sanitizedUpdate.experienceMax ?? (job as any).experienceMax;
    if (checkExpMin != null && checkExpMax != null && checkExpMin > checkExpMax) {
      sendError(res, 'experienceMin cannot be greater than experienceMax', 400);
      return;
    }
    const checkSalMin = sanitizedUpdate.salaryMin ?? (job as any).salaryMin;
    const checkSalMax = sanitizedUpdate.salaryMax ?? (job as any).salaryMax;
    if (checkSalMin != null && checkSalMax != null && checkSalMin > checkSalMax) {
      sendError(res, 'salaryMin cannot be greater than salaryMax', 400);
      return;
    }
    
    // GAP-09: If description is changing, push current version to history first
    const descriptionChanging =
      sanitizedUpdate.description !== undefined &&
      sanitizedUpdate.description !== (job as any).description;

    if (descriptionChanging && (job as any).description) {
      await Job.findByIdAndUpdate(req.params.id, {
        $push: {
          descriptionHistory: {
            version:     (job as any).version || 1,
            description: (job as any).description,
            updatedAt:   new Date(),
            updatedBy:   req.user?._id,
          },
        },
        $inc: { version: 1 },
      });
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });
    sendSuccess(res, { job: updatedJob }, "Job updated");
  } catch (error) { next(error); }
};

// Valid status transitions enforced at controller level
const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:            ['published', 'on_hold', 'pending_approval'],
  pending_approval: ['published', 'draft'],   // admin/employer: approve or push back
  published:        ['on_hold', 'closed'],
  on_hold:          ['published', 'closed', 'draft'],
  expired:          ['published'],
  closed:           [],
};

export const updateJobStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, 'Job not found', 404); return; }

    // Tenant isolation
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId.toString() !== tenantId) {
      logger.warn(`[updateJobStatus] Access denied: ${req.user?.email} tried to update job from another company`);
      sendError(res, "You don't have permission to update this job", 403);
      return;
    }

    let newStatus = req.body.status as string;
    const currentStatus = job.status as string;

    // HR submitting for "published" automatically enters the approval queue
    // Admin and Employer can publish directly
    if (
      newStatus === JobStatus.PUBLISHED &&
      req.user?.role === UserRole.HR
    ) {
      newStatus = JobStatus.PENDING_APPROVAL;
    }

    const allowed = JOB_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      sendError(res, `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`, 400);
      return;
    }

    // Require description before publishing or submitting for approval
    if (newStatus === JobStatus.PUBLISHED || newStatus === JobStatus.PENDING_APPROVAL) {
      const descText = ((job as any).description || '').replace(/<[^>]*>/g, '').trim();
      if (!descText || descText.length < 10) {
        sendError(res, 'Job description is required before publishing (at least 10 characters).', 400);
        return;
      }
    }

    (job as any).status = newStatus;
    await job.save();
    logger.info(`[updateJobStatus] Job ${job._id} transitioned ${currentStatus} → ${newStatus} by ${req.user?.email}`);

    // Auto-post to any pending portals when job is published
    if (newStatus === JobStatus.PUBLISHED) {
      setImmediate(() => {
        void triggerPendingPortalPostings(String(job._id)).catch(() => {});
      });
    }

    const message =
      newStatus === JobStatus.PENDING_APPROVAL
        ? 'Job submitted for approval'
        : 'Job status updated';
    sendSuccess(res, { job }, message);
  } catch (error) { next(error); }
};

/**
 * @desc    Approve a job that is pending approval — publishes it immediately
 * @route   PATCH /api/v1/jobs/:id/approve
 * @access  Private (Employer, Admin only)
 */
export const approveJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, 'Job not found', 404); return; }

    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId.toString() !== tenantId) {
      sendError(res, "You don't have permission to approve this job", 403);
      return;
    }

    if ((job as any).status !== JobStatus.PENDING_APPROVAL) {
      sendError(res, `Job is not pending approval (current status: ${(job as any).status})`, 400);
      return;
    }

    (job as any).status = JobStatus.PUBLISHED;
    (job as any).approvedBy  = req.user?._id;
    (job as any).approvedAt  = new Date();
    await job.save();
    logger.info(`[approveJob] Job ${job._id} approved and published by ${req.user?.email}`);

    setImmediate(() => {
      void triggerPendingPortalPostings(String(job._id)).catch(() => {});
    });

    sendSuccess(res, { job }, 'Job approved and published');
  } catch (error) { next(error); }
};

/**
 * @desc    Reject job approval — returns job to draft with optional remarks
 * @route   PATCH /api/v1/jobs/:id/reject-approval
 * @access  Private (Employer, Admin only)
 */
export const rejectJobApproval = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, 'Job not found', 404); return; }

    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId.toString() !== tenantId) {
      sendError(res, "You don't have permission to reject this job", 403);
      return;
    }

    if ((job as any).status !== JobStatus.PENDING_APPROVAL) {
      sendError(res, `Job is not pending approval (current status: ${(job as any).status})`, 400);
      return;
    }

    (job as any).status = JobStatus.DRAFT;
    if (req.body.remarks) {
      (job as any).approvalRemarks = req.body.remarks;
    }
    await job.save();
    logger.info(`[rejectJobApproval] Job ${job._id} approval rejected by ${req.user?.email}`);
    sendSuccess(res, { job }, 'Job approval rejected — returned to draft');
  } catch (error) { next(error); }
};

export const deleteJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, "Job not found", 404); return; }
    
    // Authorization: ALL roles must have matching companyId for deletes (SEC-05/B-04)
    const userRole = req.user?.role;
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      if (job.companyId.toString() !== tenantId) {
        logger.warn(`[deleteJob] Access denied: ${req.user?.email} tried to delete job from another company`);
        sendError(res, "You don't have permission to delete this job", 403);
        return;
      }
    }
    
    job.deletedAt = new Date();
    await job.save();
    sendSuccess(res, null, "Job deleted");
  } catch (error) { next(error); }
};

