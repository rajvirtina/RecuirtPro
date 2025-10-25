import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { User, RateLimitLog, Invitation } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import { sendEmail } from '../services/emailService';
import crypto from 'crypto';
import { config } from '../config';
import { AuthRequest, UserStatus, AuditAction } from '../types';
import { AuditLog } from '../models/AuditLog';

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendError(res, 'Validation failed', 400, errors.array());
      return;
    }

    const { email, password, firstName, lastName, role, phoneNumber, invitationToken } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    let userRole = 'candidate';
    let companyId;

    // Handle invitation-based registration
    if (invitationToken) {
      const invitation = await Invitation.findOne({ token: invitationToken });

      if (!invitation) {
        sendError(res, 'Invalid invitation token', 400);
        return;
      }

      if (invitation.status === 'accepted') {
        sendError(res, 'Invitation has already been used', 400);
        return;
      }

      if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
        invitation.status = 'expired';
        await invitation.save();
        sendError(res, 'Invitation has expired', 400);
        return;
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        sendError(res, 'Email does not match invitation', 400);
        return;
      }

      userRole = invitation.role;
      companyId = invitation.companyId;

      // Mark invitation as accepted
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitation.save();
    } else {
      // Non-invited registration
      // Block employer/HR/admin/interviewer registration - they must be invited
      const restrictedRoles = ['employer', 'hr', 'admin', 'interviewer'];
      if (role && restrictedRoles.includes(role.toLowerCase())) {
        sendError(res, 'This role requires an invitation from an administrator. Please contact support.', 403);
        return;
      }
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role: userRole,
      phoneNumber,
      companyId,
    });

    // Check if email verification is enabled
    const emailVerificationEnabled = config.features.emailVerification;
    
    if (emailVerificationEnabled) {
      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Send verification email
      const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
      try {
        await sendEmail({
          to: user.email,
          subject: 'Verify Your Email - RecuirtPro',
          template: 'emailVerification',
          data: {
            name: user.firstName,
            verificationUrl,
          },
        });
        await user.save();
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // In development, auto-activate if email fails
        if (config.env === 'development') {
          logger.info('Development mode: Auto-activating user due to email failure');
          user.status = UserStatus.ACTIVE;
          user.emailVerified = true;
          await user.save();
        }
      }
    } else {
      // Email verification disabled - auto-activate
      logger.info('Email verification disabled: Auto-activating user');
      user.status = UserStatus.ACTIVE;
      user.emailVerified = true;
      await user.save();
    }

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.info(`New user registered: ${user.email}`);

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    }, 'Registration successful. Please check your email to verify your account.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendError(res, 'Validation failed', 400, errors.array());
      return;
    }

    const { email, password } = req.body;

    // Find user by credentials
    const user = await User.findByCredentials(email, password);

    if (!user) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Check if user is active
    if (!user.deletedAt === null) {
      sendError(res, 'Your account has been deactivated. Please contact support.', 403);
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.info(`User logged in: ${user.email}`);

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        isMfaEnabled: user.mfaEnabled || false,
      },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, { user }, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In a more advanced implementation, you would invalidate the refresh token
    // For now, we'll just send a success response
    logger.info(`User logged out: ${req.user?.email}`);
    
    sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
export const refresh = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendError(res, 'Refresh token is required', 400);
      return;
    }

    // Verify refresh token
    const decoded = await User.verifyRefreshToken(refreshToken);
    
    const user = await User.findById(decoded.id);
    
    if (!user || !user.deletedAt === null) {
      sendError(res, 'Invalid refresh token', 401);
      return;
    }

    // Generate new access token
    const accessToken = user.generateAuthToken();

    sendSuccess(res, { accessToken }, 'Token refreshed successfully');
  } catch (error) {
    sendError(res, 'Invalid refresh token', 401);
  }
};

/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      sendError(res, 'Verification token is required', 400);
      return;
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      sendError(res, 'Invalid or expired verification token', 400);
      return;
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info(`Email verified: ${user.email}`);

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    }, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // Rate limiting check - 5 attempts per hour per email
    const rateLimitKey = `${email.toLowerCase()}_${ipAddress}`;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    let rateLimitLog = await RateLimitLog.findOne({
      identifier: rateLimitKey,
      action: 'password_reset',
      createdAt: { $gte: oneHourAgo },
    });

    // Check if blocked
    if (rateLimitLog?.blockedUntil && rateLimitLog.blockedUntil > new Date()) {
      const minutesLeft = Math.ceil((rateLimitLog.blockedUntil.getTime() - Date.now()) / 60000);
      logger.warn(`Password reset blocked for ${email} from ${ipAddress}. Blocked for ${minutesLeft} more minutes.`);
      
      sendError(res, `Too many password reset attempts. Please try again in ${minutesLeft} minutes.`, 429);
      return;
    }

    // Check attempt count
    if (rateLimitLog) {
      if (rateLimitLog.attempts >= 5) {
        // Block for 1 hour
        rateLimitLog.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
        rateLimitLog.lastAttempt = new Date();
        await rateLimitLog.save();

        logger.warn(`Password reset rate limit exceeded for ${email} from ${ipAddress}`);
        
        sendError(res, 'Too many password reset attempts. Please try again in 1 hour.', 429);
        return;
      }

      // Increment attempts
      rateLimitLog.attempts += 1;
      rateLimitLog.lastAttempt = new Date();
      await rateLimitLog.save();
    } else {
      // Create new rate limit log
      rateLimitLog = await RateLimitLog.create({
        identifier: rateLimitKey,
        action: 'password_reset',
        attempts: 1,
        ipAddress,
        userAgent: req.get('user-agent'),
      });
    }

    const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      // Don't reveal if user exists or not for security
      logger.info(`Password reset requested for non-existent email: ${email}`);
      sendSuccess(res, null, 'If an account exists with that email, a password reset link has been sent.');
      return;
    }

    // Invalidate any previous reset tokens
    if (user.passwordResetToken) {
      logger.info(`Invalidating previous reset token for: ${user.email}`);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.PASSWORD_CHANGE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `Password reset requested for user: ${user.email}`,
      metadata: {
        action: 'password_reset_requested',
        email: user.email,
      },
      ipAddress,
      userAgent: req.get('user-agent'),
    });

    // Send reset email
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - RecuirtPro',
        template: 'passwordReset',
        data: {
          name: user.firstName,
          resetUrl,
          ipAddress,
          timestamp: new Date().toLocaleString(),
          location: 'Unknown', // Can be enhanced with IP geolocation
        },
      });

      logger.info(`Password reset email sent to: ${user.email} from IP: ${ipAddress}`);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      sendError(res, 'Failed to send password reset email. Please try again later.', 500);
      return;
    }

    sendSuccess(res, null, 'If an account exists with that email, a password reset link has been sent.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    if (!token || !password) {
      sendError(res, 'Token and new password are required', 400);
      return;
    }

    // Password validation
    if (password.length < 8) {
      sendError(res, 'Password must be at least 8 characters long', 400);
      return;
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
      deletedAt: null,
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      logger.warn(`Invalid or expired reset token attempt from IP: ${ipAddress}`);
      sendError(res, 'Invalid or expired reset token', 400);
      return;
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Force re-authentication by updating a timestamp field
    // This can be used to invalidate existing JWT tokens
    user.lastLogin = new Date(0); // Reset last login
    
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.PASSWORD_CHANGE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `Password reset completed for user: ${user.email}`,
      metadata: {
        action: 'password_reset_completed',
        email: user.email,
      },
      ipAddress,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Password reset successful for: ${user.email} from IP: ${ipAddress}`);

    // Send confirmation email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Changed Successfully - RecuirtPro',
        template: 'passwordChanged',
        data: {
          name: user.firstName,
          timestamp: new Date().toLocaleString(),
          ipAddress,
        },
      });
    } catch (emailError) {
      logger.error('Failed to send password changed email:', emailError);
    }

    // Clear rate limit logs for this user
    await RateLimitLog.deleteMany({
      identifier: { $regex: user.email.toLowerCase(), $options: 'i' },
      action: 'password_reset',
    });

    sendSuccess(res, null, 'Password reset successful. Please login with your new password.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      sendError(res, 'Current password is incorrect', 401);
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed: ${user.email}`);

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Private
 */
export const resendVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    if (user.emailVerified) {
      sendError(res, 'Email is already verified', 400);
      return;
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Send verification email
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - RecuirtPro',
      template: 'emailVerification',
      data: {
        name: user.firstName,
        verificationUrl,
      },
    });

    logger.info(`Verification email resent to: ${user.email}`);

    sendSuccess(res, null, 'Verification email sent successfully');
  } catch (error) {
    next(error);
  }
};
