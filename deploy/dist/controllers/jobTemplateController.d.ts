import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Get all job templates for the company
 * @route   GET /api/v1/job-templates
 */
export declare const getJobTemplates: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Create a job template
 * @route   POST /api/v1/job-templates
 */
export declare const createJobTemplate: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Create template from existing job
 * @route   POST /api/v1/job-templates/from-job/:jobId
 */
export declare const createTemplateFromJob: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Delete a job template
 * @route   DELETE /api/v1/job-templates/:id
 */
export declare const deleteJobTemplate: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Duplicate an existing job (copy to new draft)
 * @route   POST /api/v1/jobs/:id/duplicate
 */
export declare const duplicateJob: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=jobTemplateController.d.ts.map