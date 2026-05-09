/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { Response } from 'express';
import { AuthRequest, UserRole, UserStatus, AuditAction } from '../types';
import { sendSuccess, sendError, clampPagination } from '../utils/response';
import { User, Company, Job, Application, Interview } from '../models';
import { AuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';
import { sendEmail } from '../services/emailService';
import logger from '../utils/logger';
import crypto from 'crypto';
import { config } from '../config';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';

/**
 * @desc    Invite HR user (Admin only)
 * @route   POST /api/v1/admin/invite-hr
 * @access  Private/Admin
 */
export const inviteHR = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, firstName, lastName, role, department, phone } = req.body;

    // Validate input
    if (!email || !firstName || !lastName) {
      sendError(res, 'Email, first name, and last name are required', 400);
      return;
    }

    // Validate role - only HR, INTERVIEWER, or EMPLOYER allowed
    const allowedRoles = [UserRole.HR, UserRole.INTERVIEWER, UserRole.EMPLOYER];
    const hrRole = role || UserRole.HR;
    
    if (!allowedRoles.includes(hrRole)) {
      sendError(res, 'Invalid role. Only HR, Interviewer, or Employer roles can be invited', 400);
      return;
    }

    // Email domain validation: HR email must match company or admin domain
    const inviterCompanyId = req.user?.companyId;
    const invitedEmailDomain = email.toLowerCase().split('@')[1];
    const adminEmailDomain = req.user?.email?.toLowerCase().split('@')[1];

    // Block common public email providers
    const publicDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
      'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
      'live.com', 'msn.com', 'rediffmail.com', 'google.com',
    ];

    let companyEmailDomain: string | undefined;

    if (inviterCompanyId) {
      const company = await Company.findById(inviterCompanyId);
      if (company) {
        companyEmailDomain = company.email.toLowerCase().split('@')[1];
      }
    }

    // Use whichever domain we have: company domain takes priority, fallback to admin domain
    const enforcedDomain = companyEmailDomain || adminEmailDomain;

    if (enforcedDomain) {
      const matchesCompanyDomain = companyEmailDomain && invitedEmailDomain === companyEmailDomain;
      const matchesAdminDomain = adminEmailDomain && invitedEmailDomain === adminEmailDomain;

      // If enforced domain is corporate (not public), HR must match
      if (!publicDomains.includes(enforcedDomain)) {
        if (!matchesCompanyDomain && !matchesAdminDomain) {
          sendError(
            res,
            `Email domain "@${invitedEmailDomain}" does not match company domain "@${enforcedDomain}". HR users must use a company email address.`,
            400
          );
          return;
        }
      } else {
        // Enforced domain is public — invited must match exactly
        if (!matchesCompanyDomain && !matchesAdminDomain) {
          sendError(
            res,
            `Email domain "@${invitedEmailDomain}" does not match the registered company email domain "@${enforcedDomain}".`,
            400
          );
          return;
        }
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      deletedAt: null 
    });
    
    if (existingUser) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    // Generate invitation token (48 hour expiry)
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');

    // Create user in PENDING status with temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: tempPassword, // Will be changed during registration
      firstName,
      lastName,
      role: hrRole,
      companyId: inviterCompanyId,
      status: UserStatus.PENDING_VERIFICATION,
      phone,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      emailVerified: false,
      mfaEnabled: false,
    });

    // Create audit log
    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.CREATE,
      resource: 'User',
      resourceId: newUser._id.toString(),
      description: `Invited HR user: ${newUser.email} (${newUser.role}) to department: ${department || 'N/A'}`,
      metadata: {
        invitedUser: newUser.email,
        role: newUser.role,
        department,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send invitation email
    const invitationUrl = `${config.frontendUrl}/complete-registration?token=${invitationToken}`;
    
    try {
      // In dev mode with SKIP_EMAIL, sendEmail will log to console
      const skipEmail = process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true';

      // Only validate email config if we're actually going to send
      if (!skipEmail && (!config.email.host || !config.email.user || !config.email.password)) {
        logger.error('Email configuration not set. SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured in .env');
        await User.findByIdAndDelete(newUser._id);
        sendError(res, 'Email service not configured. Please contact administrator.', 500);
        return;
      }

      await sendEmail({
        to: newUser.email,
        subject: 'Welcome to RecuirtPro - Complete Your Registration',
        template: 'hrInvitation',
        data: {
          name: firstName,
          inviterName: `${req.user?.firstName} ${req.user?.lastName}`,
          role: hrRole,
          department: department || 'N/A',
          invitationUrl,
          expiryHours: 48,
          companyName: config.companyName || 'RecuirtPro',
          supportEmail: config.supportEmail || 'support@recuritpro.com',
        },
      });

      logger.info(`HR invitation sent to: ${newUser.email} by ${req.user?.email}`);

      sendSuccess(res, {
        user: {
          id: newUser._id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          status: newUser.status,
        },
        invitationSent: true,
      }, 'HR user invited successfully', 201);
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
      logger.error('Email Config Check:', {
        hostConfigured: !!config.email.host,
        userConfigured: !!config.email.user,
        passwordConfigured: !!config.email.password,
        portConfigured: config.email.port,
      });
      
      // Delete the created user if email fails
      await User.findByIdAndDelete(newUser._id);
      
      let errorMessage = 'Failed to send invitation email. Please try again.';
      
      if (emailError instanceof Error) {
        if (emailError.message.includes('Invalid login') || emailError.message.includes('Username and Password not accepted')) {
          errorMessage = 'Gmail authentication failed. Please update .env with a valid App Password. ' +
                        'Generate one at: https://myaccount.google.com/apppasswords (requires 2-Step Verification enabled). ' +
                        'Set SMTP_USER=your-email@gmail.com and SMTP_PASSWORD=your-16-digit-app-password';
        } else if (emailError.message.includes('SMTP')) {
          errorMessage = 'Email service configuration error. Please verify SMTP settings in .env file.';
        }
      }
      
      sendError(res, errorMessage, 500);
    }
  } catch (error) {
    logger.error('Error inviting HR:', error);
    sendError(res, 'Failed to invite HR user', 500);
  }
};

/**
 * @desc    Get all HR users (Admin only)
 * @route   GET /api/v1/admin/hr-users
 * @access  Private/Admin
 */
export const getHRUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, role, search, page = 1, limit = 10 } = req.query;

    const query: any = {
      role: { $in: [UserRole.HR, UserRole.INTERVIEWER, UserRole.EMPLOYER] },
      deletedAt: null,
    };

    // TENANT ISOLATION: Scope to user's company (super admin sees all)
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      query.companyId = tenantId;
    }

    if (status) {
      query.status = status;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -mfaSecret -emailVerificationToken -passwordResetToken')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    sendSuccess(res, {
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    }, 'HR users retrieved successfully');
  } catch (error) {
    logger.error('Error getting HR users:', error);
    sendError(res, 'Failed to retrieve HR users', 500);
  }
};

/**
 * @desc    Activate/Deactivate HR user (Admin only)
 * @route   PATCH /api/v1/admin/hr-users/:id/status
 * @access  Private/Admin
 */
export const updateHRStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(UserStatus).includes(status)) {
      sendError(res, 'Invalid status', 400);
      return;
    }

    const user = await User.findOne({ 
      _id: id,
      role: { $in: [UserRole.HR, UserRole.INTERVIEWER, UserRole.EMPLOYER] },
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'HR user not found', 404);
      return;
    }

    // TENANT ISOLATION: Company admin can only manage their own company's users
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && user.companyId?.toString() !== tenantId) {
      sendError(res, 'Not authorized to manage this user', 403);
      return;
    }

    // Prevent deactivating yourself
    if (user._id.toString() === req.user?._id.toString()) {
      sendError(res, 'You cannot change your own status', 400);
      return;
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.STATUS_CHANGE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `User status changed: ${user.email} from ${oldStatus} to ${status}`,
      metadata: {
        oldStatus,
        newStatus: status,
        targetUser: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`HR user ${user.email} status changed from ${oldStatus} to ${status} by ${req.user?.email}`);

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    }, 'HR user status updated successfully');
  } catch (error) {
    logger.error('Error updating HR status:', error);
    sendError(res, 'Failed to update HR user status', 500);
  }
};

/**
 * @desc    Resend HR invitation (Admin only)
 * @route   POST /api/v1/admin/hr-users/:id/resend-invitation
 * @access  Private/Admin
 */
export const resendHRInvitation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ 
      _id: id,
      role: { $in: [UserRole.HR, UserRole.INTERVIEWER, UserRole.EMPLOYER] },
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'HR user not found', 404);
      return;
    }

    // TENANT ISOLATION: Company admin can only resend invitations for own company's users
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && user.companyId?.toString() !== tenantId) {
      sendError(res, 'Not authorized to manage this user', 403);
      return;
    }

    if (user.status === UserStatus.ACTIVE && user.emailVerified) {
      sendError(res, 'User has already completed registration', 400);
      return;
    }

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    await user.save();

    // Send invitation email
    const invitationUrl = `${config.frontendUrl}/complete-registration?token=${invitationToken}`;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reminder: Complete Your RecuirtPro Registration',
        template: 'hrInvitation',
        data: {
          name: user.firstName,
          inviterName: `${req.user?.firstName} ${req.user?.lastName}`,
          role: user.role,
          invitationUrl,
          expiryHours: 48,
          companyName: config.companyName || 'RecuirtPro',
          supportEmail: config.supportEmail || 'support@recuritpro.com',
          isResend: true,
        },
      });

      // Create audit log
      await AuditLog.create({
        userId: req.user?._id,
        action: AuditAction.UPDATE,
        resource: 'User',
        resourceId: user._id.toString(),
        description: `Invitation resent to HR user: ${user.email}`,
        metadata: {
          action: 'resend_invitation',
          targetUser: user.email,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logger.info(`HR invitation resent to: ${user.email} by ${req.user?.email}`);

      sendSuccess(res, {
        invitationSent: true,
      }, 'Invitation email resent successfully');
    } catch (emailError) {
      logger.error('Failed to resend invitation email:', emailError);
      sendError(res, 'Failed to send invitation email. Please try again.', 500);
    }
  } catch (error) {
    logger.error('Error resending HR invitation:', error);
    sendError(res, 'Failed to resend invitation', 500);
  }
};

/**
 * @desc    Delete HR user (Admin only - soft delete)
 * @route   DELETE /api/v1/admin/hr-users/:id
 * @access  Private/Admin
 */
export const deleteHRUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ 
      _id: id,
      role: { $in: [UserRole.HR, UserRole.INTERVIEWER, UserRole.EMPLOYER] },
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'HR user not found', 404);
      return;
    }

    // TENANT ISOLATION: Company admin can only delete their own company's users
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && user.companyId?.toString() !== tenantId) {
      sendError(res, 'Not authorized to delete this user', 403);
      return;
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user?._id.toString()) {
      sendError(res, 'You cannot delete your own account', 400);
      return;
    }

    const deletedEmail = user.email;
    const deletedRole = user.role;

    // Soft delete — preserve audit trail (GAP-02)
    user.deletedAt = new Date();
    user.status = UserStatus.INACTIVE;
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.DELETE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `HR user soft-deleted: ${deletedEmail} (${deletedRole})`,
      metadata: {
        deletedUser: deletedEmail,
        role: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`HR user ${user.email} deleted by ${req.user?.email}`);

    sendSuccess(res, null, 'HR user deleted successfully');
  } catch (error) {
    logger.error('Error deleting HR user:', error);
    sendError(res, 'Failed to delete HR user', 500);
  }
};

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/v1/admin/stats
 * @access  Private/Admin
 */
export const getAdminStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Models imported at top of file
    
    // TENANT ISOLATION: Scope stats to user's company (super admin sees all)
    const tenantId = getTenantCompanyId(req.user);
    const tenantFilter: any = tenantId ? { companyId: tenantId } : {};
    const userTenantFilter: any = tenantId ? { companyId: tenantId, deletedAt: null } : { deletedAt: null };

    const [
      totalUsers,
      totalCandidates,
      totalHR,
      activeHR,
      pendingHR,
      suspendedHR,
      totalCompanies,
      totalJobs,
      totalApplications,
      activeInterviews,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments(userTenantFilter),
      tenantId 
        ? User.countDocuments({ role: UserRole.CANDIDATE, deletedAt: null, companyId: tenantId })
        : User.countDocuments({ role: UserRole.CANDIDATE, deletedAt: null }),
      User.countDocuments({ 
        role: { $in: [UserRole.HR, UserRole.EMPLOYER, UserRole.INTERVIEWER] },
        ...userTenantFilter
      }),
      User.countDocuments({ 
        role: { $in: [UserRole.HR, UserRole.EMPLOYER, UserRole.INTERVIEWER] },
        status: 'active',
        ...userTenantFilter
      }),
      User.countDocuments({ 
        role: { $in: [UserRole.HR, UserRole.EMPLOYER, UserRole.INTERVIEWER] },
        status: 'pending_verification',
        ...userTenantFilter
      }),
      User.countDocuments({ 
        role: { $in: [UserRole.HR, UserRole.EMPLOYER, UserRole.INTERVIEWER] },
        status: 'suspended',
        ...userTenantFilter
      }),
      tenantId ? Promise.resolve(1) : Company.countDocuments(),
      Job.countDocuments(tenantFilter),
      Application.countDocuments(tenantFilter),
      Interview.countDocuments({ 
        status: { $in: ['scheduled', 'in_progress'] },
        ...tenantFilter
      }),
      AuditLog.find(tenantId ? { 'metadata.companyId': tenantId } : {})
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'firstName lastName email')
        .lean(),
    ]);

    // Check system health
    const dbStatus = mongoose.connection?.readyState === 1 ? 'healthy' : 'unhealthy';

    const activityData = recentActivity.map((log: any) => ({
      id: log._id,
      type: log.action.includes('USER') ? 'user' : 
            log.action.includes('JOB') ? 'job' :
            log.action.includes('APPLICATION') ? 'application' : 'system',
      description: log.description || log.action,
      timestamp: log.timestamp,
      user: log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'System',
    }));

    sendSuccess(res, {
      totalUsers,
      totalCandidates,
      totalHR,
      activeHR,
      pendingHR,
      suspendedHR,
      totalCompanies,
      totalJobs,
      totalApplications,
      activeInterviews,
      systemHealth: {
        database: dbStatus,
        redis: 'not-configured',
        storage: 'healthy',
      },
      recentActivity: activityData,
    }, 'Admin stats retrieved successfully');
  } catch (error) {
    logger.error('Error getting admin stats:', error);
    sendError(res, 'Failed to retrieve admin stats', 500);
  }
};

/**
 * @desc    Get all companies (Super Admin)
 * @route   GET /api/v1/admin/companies
 * @access  Private/SuperAdmin
 */
export const getCompanies = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const companies = await Company.find({ deletedAt: null }).sort({ createdAt: -1 });
    sendSuccess(res, companies, 'Companies retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting companies:', error);
    sendError(res, error.message || 'Failed to retrieve companies', 500);
  }
};

/**
 * @desc    Create a new company (Super Admin)
 * @route   POST /api/v1/admin/companies
 * @access  Private/SuperAdmin
 */
export const createCompany = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, phone, website, address } = req.body;

    if (!name || !email) {
      sendError(res, 'Company name and email are required', 400);
      return;
    }
    
    // Check if company already exists
    const existingCompany = await Company.findOne({ 
      $or: [{ email: email.toLowerCase() }, { name }],
      deletedAt: null 
    });

    if (existingCompany) {
      sendError(res, 'Company with this name or email already exists', 409);
      return;
    }

    // Generate slug from company name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Ensure slug is unique (check all documents, including soft-deleted)
    let slug = baseSlug;
    let counter = 1;
    while (await Company.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const company = await Company.create({
      name,
      slug,
      email: email.toLowerCase(),
      phone,
      website,
      address,
      status: 'pending_verification',
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.CREATE,
      resource: 'Company',
      resourceId: company._id.toString(),
      description: `Created company: ${company.name}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send verification email to company email
    const verificationUrl = `${config.frontendUrl}/verify-company-email?token=${verificationToken}`;
    const skipEmail = process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true';

    if (skipEmail) {
      // Dev mode with SKIP_EMAIL: auto-verify since no real email is sent
      company.emailVerified = true;
      company.status = 'active';
      company.emailVerificationToken = undefined;
      company.emailVerificationExpires = undefined;
      await company.save();
      logger.info('Development mode (SKIP_EMAIL): Auto-verified company email');
    } else {
      try {
        await sendEmail({
          to: company.email,
          subject: 'Verify Your Company Email - RecuirtPro',
          template: 'emailVerification',
          data: {
            name: company.name,
            verificationUrl,
          },
        });
        logger.info(`Company verification email sent to: ${company.email}`);
      } catch (emailError) {
        logger.error('Failed to send company verification email:', emailError);
        // In development, auto-verify
        if (config.env === 'development') {
          company.emailVerified = true;
          company.status = 'active';
          company.emailVerificationToken = undefined;
          company.emailVerificationExpires = undefined;
          await company.save();
          logger.info('Development mode: Auto-verified company email');
        }
      }
    }

    logger.info(`Company created: ${company.name} by ${req.user?.email}`);
    sendSuccess(res, company, 'Company created successfully. Verification email sent.', 201);
  } catch (error: any) {
    logger.error('Error creating company:', error);
    sendError(res, error.message || 'Failed to create company', 500);
  }
};

/**
 * @desc    Delete a company (Super Admin)
 * @route   DELETE /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export const deleteCompany = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      sendError(res, 'Company not found', 404);
      return;
    }

    const companyName = company.name;

    // Soft-delete the company
    company.deletedAt = new Date();
    (company as any).status = 'inactive';
    await company.save();

    // Soft-delete all users belonging to this company
    await User.updateMany(
      { companyId: id, deletedAt: null },
      { $set: { deletedAt: new Date(), status: 'inactive' } }
    );

    // Soft-delete all jobs belonging to this company
    await Job.updateMany(
      { companyId: id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.DELETE,
      resource: 'Company',
      resourceId: company._id.toString(),
      description: `Soft-deleted company: ${companyName} (cascaded to users and jobs)`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Company soft-deleted: ${companyName} by ${req.user?.email}`);
    sendSuccess(res, null, 'Company deleted successfully');
  } catch (error: any) {
    logger.error('Error deleting company:', error);
    sendError(res, error.message || 'Failed to delete company', 500);
  }
};

/**
 * @desc    Get company by ID (Super Admin)
 * @route   GET /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export const getCompanyById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findOne({ _id: id, deletedAt: null });
    if (!company) {
      sendError(res, 'Company not found', 404);
      return;
    }

    // Get admin users for this company
    const companyAdmins = await User.find({
      companyId: id,
      role: { $in: ['admin', 'hr'] },
      deletedAt: null,
    }).select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

    sendSuccess(res, { company, admins: companyAdmins }, 'Company details retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting company details:', error);
    sendError(res, error.message || 'Failed to retrieve company details', 500);
  }
};

/**
 * @desc    Update company (Super Admin)
 * @route   PUT /api/v1/admin/companies/:id
 * @access  Private/SuperAdmin
 */
export const updateCompany = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, website, description, industry, size } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    const company = await Company.findOne({ _id: id, deletedAt: null });
    if (!company) {
      sendError(res, 'Company not found', 404);
      return;
    }

    // Track changes for audit
    const changes: { before: any; after: any } = { before: {}, after: {} };
    const sensitiveFieldChanged = (name && name !== company.name) || (email && email.toLowerCase() !== company.email);

    if (name && name !== company.name) {
      changes.before.name = company.name;
      changes.after.name = name;
      company.name = name;
    }
    if (email && email.toLowerCase() !== company.email) {
      changes.before.email = company.email;
      changes.after.email = email.toLowerCase();
      // New email needs verification
      const verificationToken = crypto.randomBytes(32).toString('hex');
      company.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      company.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      company.emailVerified = false;
      company.email = email.toLowerCase();

      // Send verification to new email
      try {
        await sendEmail({
          to: email.toLowerCase(),
          subject: 'Verify Your Updated Company Email - RecuirtPro',
          template: 'emailVerification',
          data: {
            name: company.name,
            verificationUrl: `${config.frontendUrl}/verify-company-email?token=${verificationToken}`,
          },
        });
      } catch (emailError) {
        logger.error('Failed to send company email verification:', emailError);
      }
    }
    if (phone !== undefined) company.phone = phone;
    if (website !== undefined) company.website = website;
    if (description !== undefined) company.description = description;
    if (industry !== undefined) company.industry = industry;
    if (size !== undefined) company.size = size;

    await company.save();

    // Audit log
    await AuditLog.create({
      userId: req.user?._id,
      action: AuditAction.UPDATE,
      resource: 'Company',
      resourceId: company._id.toString(),
      description: `Updated company: ${company.name}${sensitiveFieldChanged ? ' (sensitive fields changed)' : ''}`,
      changes,
      ipAddress,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Company updated: ${company.name} by ${req.user?.email}`);
    sendSuccess(res, company, sensitiveFieldChanged
      ? 'Company updated. Email verification required for new email.'
      : 'Company updated successfully');
  } catch (error: any) {
    logger.error('Error updating company:', error);
    sendError(res, error.message || 'Failed to update company', 500);
  }
};

/**
 * @desc    Verify company email
 * @route   POST /api/v1/admin/companies/verify-email
 * @access  Public
 */
export const verifyCompanyEmail = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      sendError(res, 'Verification token is required', 400);
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const company = await Company.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      deletedAt: null,
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!company) {
      sendError(res, 'Invalid or expired verification token', 400);
      return;
    }

    company.emailVerified = true;
    company.status = 'active';
    company.emailVerificationToken = undefined;
    company.emailVerificationExpires = undefined;
    await company.save();

    logger.info(`Company email verified: ${company.name}`);
    sendSuccess(res, { company: { id: company._id, name: company.name } }, 'Company email verified successfully');
  } catch (error: any) {
    logger.error('Error verifying company email:', error);
    sendError(res, error.message || 'Failed to verify company email', 500);
  }
};

