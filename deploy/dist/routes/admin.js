"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const adminController_1 = require("../controllers/adminController");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
/**
 * @route   POST /api/v1/admin/companies/verify-email
 * @desc    Verify company email token
 * @access  Public (no auth required - accessed via email link)
 */
router.post('/companies/verify-email', adminController_1.verifyCompanyEmail);
// Protect all remaining admin routes
router.use(auth_1.protect);
router.use((0, auth_1.authorize)(types_1.UserRole.ADMIN));
/**
 * @route   POST /api/v1/admin/invite-hr
 * @desc    Invite HR user
 * @access  Private/Admin
 */
router.post('/invite-hr', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim(),
    (0, express_validator_1.body)('role').optional().isIn(['hr', 'interviewer', 'employer']),
    (0, express_validator_1.body)('phone').optional().trim(),
], adminController_1.inviteHR);
/**
 * @route   GET /api/v1/admin/hr-users
 * @desc    Get all HR users
 * @access  Private/Admin
 */
router.get('/hr-users', adminController_1.getHRUsers);
/**
 * @route   PATCH /api/v1/admin/hr-users/:id/status
 * @desc    Update HR user status
 * @access  Private/Admin
 */
router.patch('/hr-users/:id/status', [(0, express_validator_1.body)('status').notEmpty().isIn(['active', 'inactive', 'suspended', 'pending_verification'])], adminController_1.updateHRStatus);
/**
 * @route   POST /api/v1/admin/hr-users/:id/resend-invitation
 * @desc    Resend HR invitation
 * @access  Private/Admin
 */
router.post('/hr-users/:id/resend-invitation', adminController_1.resendHRInvitation);
/**
 * @route   DELETE /api/v1/admin/hr-users/:id
 * @desc    Delete HR user (soft delete)
 * @access  Private/Admin
 */
router.delete('/hr-users/:id', adminController_1.deleteHRUser);
/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get admin dashboard stats
 * @access  Private/Admin
 */
router.get('/stats', adminController_1.getAdminStats);
/**
 * @route   GET /api/v1/admin/companies
 * @desc    Get all companies
 * @access  Private/Admin
 */
router.get('/companies', adminController_1.getCompanies);
/**
 * @route   GET /api/v1/admin/companies/:id
 * @desc    Get company details
 * @access  Private/Admin
 */
router.get('/companies/:id', adminController_1.getCompanyById);
/**
 * @route   POST /api/v1/admin/companies
 * @desc    Create a new company
 * @access  Private/Admin
 */
router.post('/companies', [
    (0, express_validator_1.body)('name').notEmpty().trim(),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('phone').optional().trim(),
    (0, express_validator_1.body)('website').optional().isURL(),
], adminController_1.createCompany);
/**
 * @route   PUT /api/v1/admin/companies/:id
 * @desc    Update a company
 * @access  Private/Admin
 */
router.put('/companies/:id', [
    (0, express_validator_1.body)('name').optional().trim(),
    (0, express_validator_1.body)('email').optional().isEmail().normalizeEmail(),
    (0, express_validator_1.body)('phone').optional().trim(),
    (0, express_validator_1.body)('website').optional(),
], adminController_1.updateCompany);
/**
 * @route   POST /api/v1/admin/companies/:id/resend-verification
 * @desc    Resend company email verification
 * @access  Private/Admin
 */
router.post('/companies/:id/resend-verification', adminController_1.resendCompanyVerification);
/**
 * @route   DELETE /api/v1/admin/companies/:id
 * @desc    Delete a company
 * @access  Private/Admin
 */
router.delete('/companies/:id', adminController_1.deleteCompany);
/**
 * @route   POST /api/v1/admin/users
 * @desc    Create company admin/HR user directly
 * @access  Private/Admin
 */
router.post('/users', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }),
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim(),
    (0, express_validator_1.body)('companyId').notEmpty(),
    (0, express_validator_1.body)('role').isIn(['admin', 'hr']),
], async (req, res) => {
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
            return sendError(res, `Email domain "@${userEmailDomain}" does not match company domain "@${companyEmailDomain}". Admin must use a company email address.`, 400);
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
        }
        else {
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
            }
            catch (emailError) {
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
    }
    catch (error) {
        const { sendError } = require('../utils/response');
        sendError(res, error.message || 'Failed to create user', 500);
    }
});
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
        const authReq = req;
        const query = { deletedAt: null };
        // TENANT ISOLATION: Scope to company for non-super-admin
        const tenantId = getTenantCompanyId(authReq.user);
        if (tenantId) {
            query.companyId = tenantId;
        }
        if (role) {
            const roles = role.split(',');
            query.role = { $in: roles };
        }
        const users = await User.find(query)
            .populate('companyId', 'name')
            .select('-password')
            .sort({ createdAt: -1 });
        sendSuccess(res, users, 'Users retrieved successfully');
    }
    catch (error) {
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
        const authReq = req;
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
        if (firstName !== undefined)
            user.firstName = firstName.trim();
        if (lastName !== undefined)
            user.lastName = lastName.trim();
        if (status !== undefined && ['active', 'inactive', 'suspended'].includes(status)) {
            user.status = status;
        }
        await user.save();
        sendSuccess(res, user, 'User updated successfully');
    }
    catch (error) {
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
        const authReq = req;
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
    }
    catch (error) {
        const { sendError } = require('../utils/response');
        sendError(res, error.message || 'Failed to delete user', 500);
    }
});
/**
 * @route   POST /api/v1/admin/users/:id/resend-verification
 * @desc    Resend user email verification
 * @access  Private/Admin
 */
router.post('/users/:id/resend-verification', adminController_1.resendUserVerification);
exports.default = router;
//# sourceMappingURL=admin.js.map