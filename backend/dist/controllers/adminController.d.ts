/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Invite HR user (Admin only)
 * @route   POST /api/v1/admin/invite-hr
 * @access  Private/Admin
 */
export declare const inviteHR: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Get all HR users (Admin only)
 * @route   GET /api/v1/admin/hr-users
 * @access  Private/Admin
 */
export declare const getHRUsers: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Activate/Deactivate HR user (Admin only)
 * @route   PATCH /api/v1/admin/hr-users/:id/status
 * @access  Private/Admin
 */
export declare const updateHRStatus: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Resend HR invitation (Admin only)
 * @route   POST /api/v1/admin/hr-users/:id/resend-invitation
 * @access  Private/Admin
 */
export declare const resendHRInvitation: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Delete HR user (Admin only - soft delete)
 * @route   DELETE /api/v1/admin/hr-users/:id
 * @access  Private/Admin
 */
export declare const deleteHRUser: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/v1/admin/stats
 * @access  Private/Admin
 */
export declare const getAdminStats: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Get all companies (Super Admin)
 * @route   GET /api/v1/admin/companies
 * @access  Private/SuperAdmin
 */
export declare const getCompanies: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Create a new company (Super Admin)
 * @route   POST /api/v1/admin/companies
 * @access  Private/SuperAdmin
 */
export declare const createCompany: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Delete a company (Super Admin)
 * @route   DELETE /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export declare const deleteCompany: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Get company by ID (Super Admin)
 * @route   GET /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export declare const getCompanyById: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Update company (Super Admin)
 * @route   PUT /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export declare const updateCompany: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Verify company email
 * @route   POST /api/v1/admin/companies/verify-email
 * @access  Public
 */
export declare const verifyCompanyEmail: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Resend company email verification
 * @route   POST /api/v1/admin/companies/:id/resend-verification
 * @access  Private/SuperAdmin
 */
export declare const resendCompanyVerification: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * @desc    Resend user (admin/HR) email verification
 * @route   POST /api/v1/admin/users/:id/resend-verification
 * @access  Private/Admin
 */
export declare const resendUserVerification: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=adminController.d.ts.map