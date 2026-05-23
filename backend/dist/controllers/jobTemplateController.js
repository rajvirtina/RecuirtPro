"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateJob = exports.deleteJobTemplate = exports.createTemplateFromJob = exports.createJobTemplate = exports.getJobTemplates = void 0;
const JobTemplate_1 = require("../models/JobTemplate");
const models_1 = require("../models");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * @desc    Get all job templates for the company
 * @route   GET /api/v1/job-templates
 */
const getJobTemplates = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company required', 400);
        const templates = await JobTemplate_1.JobTemplate.find({
            $or: [{ companyId }, { isGlobal: true }],
        })
            .sort({ name: 1 })
            .lean();
        return (0, response_1.sendSuccess)(res, templates);
    }
    catch (error) {
        logger_1.default.error('getJobTemplates error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to fetch templates', 500);
    }
};
exports.getJobTemplates = getJobTemplates;
/**
 * @desc    Create a job template
 * @route   POST /api/v1/job-templates
 */
const createJobTemplate = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company required', 400);
        const { name, title, description, responsibilities, requirements, skills, experienceMin, experienceMax, salaryMin, salaryMax, currency, location, workMode, jobType, department } = req.body;
        if (!name || !title) {
            return (0, response_1.sendError)(res, 'Template name and job title are required', 400);
        }
        const template = await JobTemplate_1.JobTemplate.create({
            companyId,
            createdBy: req.user?._id,
            name, title, description, responsibilities, requirements, skills,
            experienceMin, experienceMax, salaryMin, salaryMax, currency,
            location, workMode, jobType, department,
        });
        return (0, response_1.sendSuccess)(res, template, 'Template created', 201);
    }
    catch (error) {
        logger_1.default.error('createJobTemplate error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to create template', 500);
    }
};
exports.createJobTemplate = createJobTemplate;
/**
 * @desc    Create template from existing job
 * @route   POST /api/v1/job-templates/from-job/:jobId
 */
const createTemplateFromJob = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company required', 400);
        const job = await models_1.Job.findOne({ _id: req.params.jobId, companyId }).lean();
        if (!job)
            return (0, response_1.sendError)(res, 'Job not found', 404);
        const { name } = req.body;
        if (!name)
            return (0, response_1.sendError)(res, 'Template name is required', 400);
        const template = await JobTemplate_1.JobTemplate.create({
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
        return (0, response_1.sendSuccess)(res, template, 'Template created from job', 201);
    }
    catch (error) {
        logger_1.default.error('createTemplateFromJob error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to create template', 500);
    }
};
exports.createTemplateFromJob = createTemplateFromJob;
/**
 * @desc    Delete a job template
 * @route   DELETE /api/v1/job-templates/:id
 */
const deleteJobTemplate = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company required', 400);
        const template = await JobTemplate_1.JobTemplate.findOne({ _id: req.params.id, companyId });
        if (!template)
            return (0, response_1.sendError)(res, 'Template not found', 404);
        await template.deleteOne();
        return (0, response_1.sendSuccess)(res, null, 'Template deleted');
    }
    catch (error) {
        logger_1.default.error('deleteJobTemplate error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to delete template', 500);
    }
};
exports.deleteJobTemplate = deleteJobTemplate;
/**
 * @desc    Duplicate an existing job (copy to new draft)
 * @route   POST /api/v1/jobs/:id/duplicate
 */
const duplicateJob = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company required', 400);
        const sourceJob = await models_1.Job.findOne({ _id: req.params.id, companyId, deletedAt: null }).lean();
        if (!sourceJob)
            return (0, response_1.sendError)(res, 'Job not found', 404);
        const newJob = await models_1.Job.create({
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
        return (0, response_1.sendSuccess)(res, { job: newJob }, 'Job duplicated as draft', 201);
    }
    catch (error) {
        logger_1.default.error('duplicateJob error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to duplicate job', 500);
    }
};
exports.duplicateJob = duplicateJob;
//# sourceMappingURL=jobTemplateController.js.map