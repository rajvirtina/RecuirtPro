import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Job, Application, Company } from "../models";
import { sendSuccess, sendError, sendPaginatedResponse } from "../utils/response";
import logger from "../utils/logger";
import { JobStatus, AuthRequest } from "../types";

export const getJobs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, companySpecific } = req.query;
    const query: any = { deletedAt: null };
    
    // Log user details for debugging
    logger.info(`[getJobs] User: ${req.user?.email}, Role: ${req.user?.role}, CompanyID: ${req.user?.companyId}, Query: companySpecific=${companySpecific}`);
    
    // Always filter by company for HR/employer users, unless they're admin
    const userRole = req.user?.role;
    if ((userRole === 'hr' || userRole === 'employer') && req.user?.companyId) {
      // Convert companyId to ObjectId for proper comparison
      query.companyId = new mongoose.Types.ObjectId(req.user.companyId);
      logger.info(`[getJobs] ✅ Applying company filter: ${req.user.companyId}`);
    } else if (companySpecific === 'true' && req.user?.companyId && userRole === 'admin') {
      // Admins can optionally filter by company
      query.companyId = new mongoose.Types.ObjectId(req.user.companyId);
      logger.info(`[getJobs] ✅ Admin company filter: ${req.user.companyId}`);
    } else {
      logger.info(`[getJobs] ❌ NO company filter applied - Role: ${userRole}, HasCompanyId: ${!!req.user?.companyId}`);
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
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
    const { page = 1, limit = 10, status } = req.query;
    
    // Find company by slug
    const company = await Company.findOne({ slug, deletedAt: null });
    if (!company) {
      sendError(res, "Company not found", 404);
      return;
    }
    
    // Build query for jobs belonging to this company
    const query: any = { 
      companyId: company._id,
      deletedAt: null,
      status: status || 'published'  // Default to published jobs for public access
    };
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
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
    
    // Authorization: HR/employer can only view their company's jobs
    const userRole = req.user?.role;
    if ((userRole === 'hr' || userRole === 'employer') && req.user?.companyId) {
      const jobCompanyId = job.companyId._id.toString();
      const userCompanyId = req.user.companyId.toString();
      if (jobCompanyId !== userCompanyId) {
        logger.warn(`[getJobById] Access denied: ${req.user.email} (${userCompanyId}) tried to access job from company ${jobCompanyId}`);
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
    let companyId = req.body.companyId;
    
    if (!companyId && req.user?.companyId) {
      companyId = req.user.companyId;
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
    
    // Authorization: ALL roles (including admin) must have matching companyId for updates (SEC-05/B-04)
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      if (!req.user?.companyId || job.companyId.toString() !== req.user.companyId.toString()) {
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
    
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });
    sendSuccess(res, { job: updatedJob }, "Job updated");
  } catch (error) { next(error); }
};

export const deleteJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, "Job not found", 404); return; }
    
    // Authorization: ALL roles (including admin) must have matching companyId for deletes (SEC-05/B-04)
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      if (!req.user?.companyId || job.companyId.toString() !== req.user.companyId.toString()) {
        logger.warn(`[deleteJob] Access denied: ${req.user?.email} tried to delete job from another company`);
        sendError(res, "You don't have permission to delete this job", 403);
        return;
      }
    }
    
    const deletedJob = await Job.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }, { new: true });
    sendSuccess(res, null, "Job deleted");
  } catch (error) { next(error); }
};

