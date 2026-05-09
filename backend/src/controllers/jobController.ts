import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Job, Application, Company } from "../models";
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from "../utils/response";
import logger from "../utils/logger";
import { JobStatus, AuthRequest } from "../types";
import { isSuperAdmin, getTenantCompanyId } from "../middleware/auth";

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
      // Candidates see all published jobs
      query.status = JobStatus.PUBLISHED;
      logger.info(`[getJobs] Candidate view - published jobs only`);
    } else {
      logger.info(`[getJobs] ❌ NO company filter applied - Role: ${userRole}, HasCompanyId: ${!!req.user?.companyId}`);
    }
    
    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;
    
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
      
    const total = await Job.countDocuments(query);
    
    logger.info(`Found ${total} jobs matching query. Returning ${jobs.length} jobs for page ${pageNum}`);
    sendPaginatedResponse(res, jobs, pageNum, limitNum, total, "Jobs retrieved");
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
    jobData.status = JobStatus.DRAFT; // New jobs always start as draft

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
    
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });
    sendSuccess(res, { job: updatedJob }, "Job updated");
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

