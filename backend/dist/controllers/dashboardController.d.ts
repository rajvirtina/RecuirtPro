/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Get employer dashboard statistics
 * @route   GET /api/v1/dashboard/employer
 * @access  Private (Employer/HR/Admin)
 */
export declare const getEmployerDashboard: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get candidate dashboard statistics
 * @route   GET /api/v1/dashboard/candidate
 * @access  Private (Candidate)
 */
export declare const getCandidateDashboard: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get recruitment analytics
 * @route   GET /api/v1/dashboard/analytics
 * @access  Private (Employer/HR/Admin)
 */
export declare const getRecruitmentAnalytics: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Export recruitment report
 * @route   GET /api/v1/dashboard/export
 * @access  Private (Employer/HR/Admin)
 */
export declare const exportReport: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=dashboardController.d.ts.map