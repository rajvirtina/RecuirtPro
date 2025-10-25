/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { Request, Response } from 'express';
import { User } from '../models';
import { AuditLog } from '../models/AuditLog';
import { sendSuccess, sendError } from '../utils/response';
import { sendEmail } from '../services/emailService';
import { UserStatus, AuditAction } from '../types';
import logger from '../utils/logger';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { config } from '../config';

/**
 * @desc    Verify HR invitation token
 * @route   POST /api/v1/hr/verify-invitation
 * @access  Public
 */
export const verifyInvitationToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      sendError(res, 'Invitation token is required', 400);
      return;
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      deletedAt: null,
    }).select('-password -mfaSecret');

    if (!user) {
      sendError(res, 'Invalid or expired invitation token', 400);
      return;
    }

    // Check if already activated
    if (user.status === UserStatus.ACTIVE && user.emailVerified) {
      sendError(res, 'This invitation has already been used', 400);
      return;
    }

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tokenValid: true,
    }, 'Invitation token verified successfully');
  } catch (error) {
    logger.error('Error verifying invitation token:', error);
    sendError(res, 'Failed to verify invitation token', 500);
  }
};

/**
 * @desc    Complete HR registration
 * @route   POST /api/v1/hr/complete-registration
 * @access  Public
 */
export const completeHRRegistration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, password, phone, enable2FA } = req.body;

    if (!token || !password) {
      sendError(res, 'Token and password are required', 400);
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
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'Invalid or expired invitation token', 400);
      return;
    }

    // Check if already activated
    if (user.status === UserStatus.ACTIVE && user.emailVerified) {
      sendError(res, 'This invitation has already been used', 400);
      return;
    }

    // Update user
    user.password = password;
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = UserStatus.ACTIVE;
    
    if (phone) {
      user.phone = phone;
    }

    let mfaQRCode = null;
    let mfaSecret = null;

    // Setup 2FA if requested
    if (enable2FA) {
      const secret = speakeasy.generateSecret({
        name: `RecuirtPro (${user.email})`,
        length: 32,
      });

      user.mfaSecret = secret.base32;
      user.mfaEnabled = true;

      // Generate QR code
      mfaQRCode = await QRCode.toDataURL(secret.otpauth_url!);
      mfaSecret = secret.base32;
    }

    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.CREATE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `User registration completed: ${user.email} (${user.role})`,
      metadata: {
        action: 'complete_registration',
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send welcome email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to RecuirtPro - Registration Complete',
        template: 'registrationComplete',
        data: {
          name: user.firstName,
          email: user.email,
          role: user.role,
          loginUrl: `${config.frontendUrl}/login`,
          supportEmail: config.supportEmail || 'support@recuritpro.com',
        },
      });
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't fail the registration if email fails
    }

    logger.info(`HR registration completed: ${user.email}`);

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
      },
      accessToken,
      refreshToken,
      ...(mfaQRCode && { mfa: { qrCode: mfaQRCode, secret: mfaSecret } }),
    }, 'Registration completed successfully', 201);
  } catch (error) {
    logger.error('Error completing HR registration:', error);
    sendError(res, 'Failed to complete registration', 500);
  }
};

/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/v1/hr/verify-2fa
 * @access  Public
 */
export const verify2FA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      sendError(res, 'Email and 2FA code are required', 400);
      return;
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      deletedAt: null,
    }).select('+mfaSecret');

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      sendError(res, 'Invalid request', 400);
      return;
    }

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps before and after
    });

    if (!verified) {
      sendError(res, 'Invalid 2FA code', 401);
      return;
    }

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.LOGIN,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `2FA verification completed for user: ${user.email}`,
      metadata: {
        action: '2fa_verified',
        email: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendSuccess(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
      accessToken,
      refreshToken,
    }, '2FA verification successful');
  } catch (error) {
    logger.error('Error verifying 2FA:', error);
    sendError(res, 'Failed to verify 2FA code', 500);
  }
};

/**
 * @desc    Setup 2FA for existing user
 * @route   POST /api/v1/hr/setup-2fa
 * @access  Private
 */
export const setup2FA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.body;

    const user = await User.findOne({
      _id: userId,
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    if (user.mfaEnabled) {
      sendError(res, '2FA is already enabled', 400);
      return;
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `RecuirtPro (${user.email})`,
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Don't save yet - wait for verification
    sendSuccess(res, {
      qrCode,
      secret: secret.base32,
    }, '2FA setup initiated. Please scan the QR code and verify.');
  } catch (error) {
    logger.error('Error setting up 2FA:', error);
    sendError(res, 'Failed to setup 2FA', 500);
  }
};

/**
 * @desc    Confirm 2FA setup
 * @route   POST /api/v1/hr/confirm-2fa
 * @access  Private
 */
export const confirm2FA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, secret, code } = req.body;

    if (!userId || !secret || !code) {
      sendError(res, 'User ID, secret, and verification code are required', 400);
      return;
    }

    const user = await User.findOne({
      _id: userId,
      deletedAt: null,
    });

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      sendError(res, 'Invalid verification code', 401);
      return;
    }

    // Save the secret and enable 2FA
    user.mfaSecret = secret;
    user.mfaEnabled = true;
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.UPDATE,
      resource: 'User',
      resourceId: user._id.toString(),
      description: `2FA (Two-Factor Authentication) enabled for user: ${user.email}`,
      metadata: {
        action: '2fa_enabled',
        email: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`2FA enabled for user: ${user.email}`);

    sendSuccess(res, {
      mfaEnabled: true,
    }, '2FA enabled successfully');
  } catch (error) {
    logger.error('Error confirming 2FA:', error);
    sendError(res, 'Failed to confirm 2FA setup', 500);
  }
};
