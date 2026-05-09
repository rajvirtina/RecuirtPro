/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import {
  inviteHR,
  getHRUsers,
  updateHRStatus,
  resendHRInvitation,
  deleteHRUser,
  getAdminStats,
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  verifyCompanyEmail,
} from '../controllers/adminController';
import { body } from 'express-validator';

const router = express.Router();

// Protect all admin routes
router.use(protect);
router.use(authorize(UserRole.ADMIN));

/**
 * @route   POST /api/v1/admin/invite-hr
 * @desc    Invite HR user
 * @access  Private/Admin
 */
router.post(
  '/invite-hr',
  [
    body('email').isEmail().normalizeEmail(),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').optional().isIn(['hr', 'interviewer', 'employer']),
    body('phone').optional().trim(),
  ],
  inviteHR
);

/**
 * @route   GET /api/v1/admin/hr-users
 * @desc    Get all HR users
 * @access  Private/Admin
 */
router.get('/hr-users', getHRUsers);

/**
 * @route   PATCH /api/v1/admin/hr-users/:id/status
 * @desc    Update HR user status
 * @access  Private/Admin
 */
router.patch(
  '/hr-users/:id/status',
  [body('status').notEmpty().isIn(['active', 'inactive', 'suspended', 'pending_verification'])],
  updateHRStatus
);

/**
 * @route   POST /api/v1/admin/hr-users/:id/resend-invitation
 * @desc    Resend HR invitation
 * @access  Private/Admin
 */
router.post('/hr-users/:id/resend-invitation', resendHRInvitation);

/**
 * @route   DELETE /api/v1/admin/hr-users/:id
 * @desc    Delete HR user (soft delete)
 * @access  Private/Admin
 */
router.delete('/hr-users/:id', deleteHRUser);

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get admin dashboard stats
 * @access  Private/Admin
 */
router.get('/stats', getAdminStats);

/**
 * @route   GET /api/v1/admin/companies
 * @desc    Get all companies
 * @access  Private/Admin
 */
router.get('/companies', getCompanies);

/**
 * @route   GET /api/v1/admin/companies/:id
 * @desc    Get company details
 * @access  Private/Admin
 */
router.get('/companies/:id', getCompanyById);

/**
 * @route   POST /api/v1/admin/companies
 * @desc    Create a new company
 * @access  Private/Admin
 */
router.post(
  '/companies',
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('website').optional().isURL(),
  ],
  createCompany
);

/**
 * @route   PUT /api/v1/admin/companies/:id
 * @desc    Update a company
 * @access  Private/Admin
 */
router.put(
  '/companies/:id',
  [
    body('name').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('website').optional(),
  ],
  updateCompany
);

/**
 * @route   POST /api/v1/admin/companies/verify-email
 * @desc    Verify company email token
 * @access  Private/Admin
 */
router.post('/companies/verify-email', verifyCompanyEmail);

/**
 * @route   DELETE /api/v1/admin/companies/:id
 * @desc    Delete a company
 * @access  Private/Admin
 */
router.delete('/companies/:id', deleteCompany);

/**
 * @route   POST /api/v1/admin/users
 * @desc    Create company admin/HR user directly
 * @access  Private/Admin
 */
router.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('companyId').notEmpty(),
    body('role').isIn(['admin', 'hr']),
  ],
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyId, role } = req.body;
      const { User, Company } = require('../models');
      const { sendSuccess, sendError } = require('../utils/response');

      // Validate email domain matches company domain
      const company = await Company.findById(companyId);
      if (!company) {
        return sendError(res, 'Company not found', 404);
      }

      const companyEmailDomain = company.email.toLowerCase().split('@')[1];
      const userEmailDomain = email.toLowerCase().split('@')[1];
      if (userEmailDomain !== companyEmailDomain) {
        return sendError(
          res,
          `Email domain "@${userEmailDomain}" does not match company domain "@${companyEmailDomain}". Admin must use a company email address.`,
          400
        );
      }

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return sendError(res, 'User with this email already exists', 409);
      }

      // Create user with pending status
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

      const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        companyId,
        role,
        status: 'pending_verification',
        emailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Send activation email
      const skipEmail = process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true';
      if (skipEmail) {
        user.status = 'active';
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
      } else {
        try {
          const { sendEmail } = require('../services/emailService');
          const config = require('../config').default;
          const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
          await sendEmail({
            to: user.email,
            subject: 'Activate Your Account - RecuirtPro',
            template: 'emailVerification',
            data: { name: user.firstName, verificationUrl },
          });
        } catch (emailError) {
          // If email fails in dev, auto-activate
          if (process.env.NODE_ENV === 'development') {
            user.status = 'active';
            user.emailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save();
          }
        }
      }

      sendSuccess(res, user, skipEmail
        ? 'User created and auto-activated (dev mode)'
        : 'User created. Activation email sent.', 201);
    } catch (error: any) {
      const { sendError } = require('../utils/response');
      sendError(res, error.message || 'Failed to create user', 500);
    }
  }
);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with filters
 * @access  Private/Admin
 */
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const { User } = require('../models');
    const { sendSuccess } = require('../utils/response');
    const { getTenantCompanyId } = require('../middleware/auth');
    const authReq = req as any;
    
    const query: any = { deletedAt: null };

    // TENANT ISOLATION: Scope to company for non-super-admin
    const tenantId = getTenantCompanyId(authReq.user);
    if (tenantId) {
      query.companyId = tenantId;
    }

    if (role) {
      const roles = (role as string).split(',');
      query.role = { $in: roles };
    }

    const users = await User.find(query)
      .populate('companyId', 'name')
      .select('-password')
      .sort({ createdAt: -1 });
    
    sendSuccess(res, users, 'Users retrieved successfully');
  } catch (error: any) {
    const { sendError } = require('../utils/response');
    sendError(res, error.message || 'Failed to get users', 500);
  }
});

/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update a user's personal details (not email)
 * @access  Private/Admin
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { User } = require('../models');
    const { sendSuccess, sendError } = require('../utils/response');
    const { getTenantCompanyId } = require('../middleware/auth');
    const authReq = req as any;

    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // TENANT ISOLATION: Company admin can only update users in their company
    const tenantId = getTenantCompanyId(authReq.user);
    if (tenantId && user.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorized to update this user', 403);
    }

    const { firstName, lastName, status } = req.body;
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (status !== undefined && ['active', 'inactive', 'suspended'].includes(status)) {
      user.status = status;
    }

    await user.save();
    sendSuccess(res, user, 'User updated successfully');
  } catch (error: any) {
    const { sendError } = require('../utils/response');
    sendError(res, error.message || 'Failed to update user', 500);
  }
});

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete a user
 * @access  Private/Admin
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { User } = require('../models');
    const { sendSuccess, sendError } = require('../utils/response');
    const { getTenantCompanyId } = require('../middleware/auth');
    const authReq = req as any;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // TENANT ISOLATION: Company admin can only delete users in their company
    const tenantId = getTenantCompanyId(authReq.user);
    if (tenantId && user.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorized to delete this user', 403);
    }

    await User.findByIdAndDelete(req.params.id);
    
    sendSuccess(res, null, 'User deleted successfully');
  } catch (error: any) {
    const { sendError } = require('../utils/response');
    sendError(res, error.message || 'Failed to delete user', 500);
  }
});

export default router;
