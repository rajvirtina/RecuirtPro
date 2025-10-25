import { Response, NextFunction } from "express";
import { Job, Application } from "../models";
import { sendSuccess, sendError, sendPaginatedResponse } from "../utils/response";
import logger from "../utils/logger";
import { JobStatus, AuthRequest } from "../types";

export const getJobs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, companySpecific } = req.query;
    const query: any = { deletedAt: null };
    
    // If user is HR/employer/admin and requests company-specific jobs, filter by companyId
    if (companySpecific === 'true' && req.user?.companyId) {
      const userRole = req.user?.role;
      if (userRole === 'hr' || userRole === 'employer' || userRole === 'admin') {
        query.companyId = req.user.companyId;
      }
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
      
    const total = await Job.countDocuments(query);
    
    sendPaginatedResponse(res, jobs, pageNum, limitNum, total, "Jobs retrieved");
  } catch (error) { next(error); }
};

export const getJobById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { sendError(res, "Job not found", 404); return; }
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

    const jobData = {
      ...req.body,
      companyId,
      createdBy: req.user?._id,
    };

    const job = await Job.create(jobData);
    sendSuccess(res, { job }, "Job created", 201);
  } catch (error) { 
    next(error); 
  }
};

export const updateJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!job) { sendError(res, "Job not found", 404); return; }
    sendSuccess(res, { job }, "Job updated");
  } catch (error) { next(error); }
};

export const deleteJob = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }, { new: true });
    if (!job) { sendError(res, "Job not found", 404); return; }
    sendSuccess(res, null, "Job deleted");
  } catch (error) { next(error); }
};
