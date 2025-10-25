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
  createCompany,
  deleteCompany,
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
      const { User } = require('../models');
      const { sendSuccess, sendError } = require('../utils/response');

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return sendError(res, 'User with this email already exists', 409);
      }

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        companyId,
        role,
        status: 'active',
        emailVerified: true,
      });

      sendSuccess(res, user, 'User created successfully', 201);
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
    
    const query: any = { deletedAt: null };
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
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete a user
 * @access  Private/Admin
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { User } = require('../models');
    const { sendSuccess, sendError } = require('../utils/response');
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    user.deletedAt = new Date();
    await user.save();
    
    sendSuccess(res, null, 'User deleted successfully');
  } catch (error: any) {
    const { sendError } = require('../utils/response');
    sendError(res, error.message || 'Failed to delete user', 500);
  }
});

export default router;
