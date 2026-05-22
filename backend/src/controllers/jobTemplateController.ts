import { Response } from 'express';
import { JobTemplate } from '../models/JobTemplate';
import { Job } from '../models';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { getTenantCompanyId } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * @desc    Get all job templates for the company
 * @route   GET /api/v1/job-templates
 */
export const getJobTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'Company required', 400);

    const templates = await JobTemplate.find({
      $or: [{ companyId }, { isGlobal: true }],
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, templates);
  } catch (error: any) {
    logger.error('getJobTemplates error:', error);
    return sendError(res, error.message || 'Failed to fetch templates', 500);
  }
};

/**
 * @desc    Create a job template
 * @route   POST /api/v1/job-templates
 */
export const createJobTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'Company required', 400);

    const { name, title, description, responsibilities, requirements, skills,
      experienceMin, experienceMax, salaryMin, salaryMax, currency,
      location, workMode, jobType, department } = req.body;

    if (!name || !title) {
      return sendError(res, 'Template name and job title are required', 400);
    }

    const template = await JobTemplate.create({
      companyId,
      createdBy: req.user?._id,
      name, title, description, responsibilities, requirements, skills,
      experienceMin, experienceMax, salaryMin, salaryMax, currency,
      location, workMode, jobType, department,
    });

    return sendSuccess(res, template, 'Template created', 201);
  } catch (error: any) {
    logger.error('createJobTemplate error:', error);
    return sendError(res, error.message || 'Failed to create template', 500);
  }
};

/**
 * @desc    Create template from existing job
 * @route   POST /api/v1/job-templates/from-job/:jobId
 */
export const createTemplateFromJob = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'Company required', 400);

    const job = await Job.findOne({ _id: req.params.jobId, companyId }).lean();
    if (!job) return sendError(res, 'Job not found', 404);

    const { name } = req.body;
    if (!name) return sendError(res, 'Template name is required', 400);

    const template = await JobTemplate.create({
      companyId,
      createdBy: req.user?._id,
      name,
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      skills: job.skills,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      location: job.location,
      workMode: job.workMode,
      jobType: job.jobType,
      department: job.department,
    });

    return sendSuccess(res, template, 'Template created from job', 201);
  } catch (error: any) {
    logger.error('createTemplateFromJob error:', error);
    return sendError(res, error.message || 'Failed to create template', 500);
  }
};

/**
 * @desc    Delete a job template
 * @route   DELETE /api/v1/job-templates/:id
 */
export const deleteJobTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'Company required', 400);

    const template = await JobTemplate.findOne({ _id: req.params.id, companyId });
    if (!template) return sendError(res, 'Template not found', 404);

    await template.deleteOne();
    return sendSuccess(res, null, 'Template deleted');
  } catch (error: any) {
    logger.error('deleteJobTemplate error:', error);
    return sendError(res, error.message || 'Failed to delete template', 500);
  }
};

/**
 * @desc    Duplicate an existing job (copy to new draft)
 * @route   POST /api/v1/jobs/:id/duplicate
 */
export const duplicateJob = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'Company required', 400);

    const sourceJob = await Job.findOne({ _id: req.params.id, companyId, deletedAt: null }).lean();
    if (!sourceJob) return sendError(res, 'Job not found', 404);

    const newJob = await Job.create({
      companyId,
      createdBy: req.user?._id,
      title: `${sourceJob.title} (Copy)`,
      description: sourceJob.description,
      responsibilities: sourceJob.responsibilities,
      requirements: sourceJob.requirements,
      skills: sourceJob.skills,
      experienceMin: sourceJob.experienceMin,
      experienceMax: sourceJob.experienceMax,
      salaryMin: sourceJob.salaryMin,
      salaryMax: sourceJob.salaryMax,
      currency: sourceJob.currency,
      location: sourceJob.location,
      workMode: sourceJob.workMode,
      jobType: sourceJob.jobType,
      department: sourceJob.department,
      positions: sourceJob.positions,
      tags: sourceJob.tags,
      status: 'draft',
      previousVersionId: sourceJob._id,
    });

    return sendSuccess(res, { job: newJob }, 'Job duplicated as draft', 201);
  } catch (error: any) {
    logger.error('duplicateJob error:', error);
    return sendError(res, error.message || 'Failed to duplicate job', 500);
  }
};
