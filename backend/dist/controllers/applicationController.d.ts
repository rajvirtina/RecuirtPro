import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Submit a job application
 * @route   POST /api/v1/applications
 * @access  Private (Candidate)
 */
export declare const submitApplication: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get all applications (with filters)
 * @route   GET /api/v1/applications
 * @access  Private (Employer/HR/Admin for job applications, Candidate for own applications)
 */
export declare const getApplications: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get single application by ID
 * @route   GET /api/v1/applications/:id
 * @access  Private (Application owner or Employer/HR/Admin)
 */
export declare const getApplicationById: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update application status
 * @route   PUT /api/v1/applications/:id/status
 * @access  Private (Employer/HR/Admin only)
 */
export declare const updateApplicationStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Withdraw application
 * @route   DELETE /api/v1/applications/:id
 * @access  Private (Candidate - application owner only)
 */
export declare const withdrawApplication: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get application statistics
 * @route   GET /api/v1/applications/stats
 * @access  Private (Employer/HR/Admin)
 */
export declare const getApplicationStats: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Download resume for an application
 * @route   GET /api/v1/applications/:id/resume
 * @access  Private (HR/Employer/Admin or application owner)
 */
export declare const downloadResume: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Check if candidate has applied to a job
 * @route   GET /api/v1/applications/check/:jobId
 * @access  Private (Candidate)
 */
export declare const checkApplicationStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=applicationController.d.ts.map