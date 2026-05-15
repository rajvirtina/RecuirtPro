"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirm2FA = exports.setup2FA = exports.verify2FA = exports.completeHRRegistration = exports.verifyInvitationToken = void 0;
const models_1 = require("../models");
const AuditLog_1 = require("../models/AuditLog");
const response_1 = require("../utils/response");
const emailService_1 = require("../services/emailService");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const config_1 = require("../config");
/**
 * @desc    Verify HR invitation token
 * @route   POST /api/v1/hr/verify-invitation
 * @access  Public
 */
const verifyInvitationToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            (0, response_1.sendError)(res, 'Invitation token is required', 400);
            return;
        }
        // Hash the token
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Find user with this token
        const user = await models_1.User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
            deletedAt: null,
        }).select('-password -mfaSecret');
        if (!user) {
            (0, response_1.sendError)(res, 'Invalid or expired invitation token', 400);
            return;
        }
        // Check if already activated
        if (user.status === types_1.UserStatus.ACTIVE && user.emailVerified) {
            (0, response_1.sendError)(res, 'This invitation has already been used', 400);
            return;
        }
        (0, response_1.sendSuccess)(res, {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
            tokenValid: true,
        }, 'Invitation token verified successfully');
    }
    catch (error) {
        logger_1.default.error('Error verifying invitation token:', error);
        (0, response_1.sendError)(res, 'Failed to verify invitation token', 500);
    }
};
exports.verifyInvitationToken = verifyInvitationToken;
/**
 * @desc    Complete HR registration
 * @route   POST /api/v1/hr/complete-registration
 * @access  Public
 */
const completeHRRegistration = async (req, res) => {
    try {
        const { token, password, phone, enable2FA } = req.body;
        if (!token || !password) {
            (0, response_1.sendError)(res, 'Token and password are required', 400);
            return;
        }
        // Password validation
        if (password.length < 8) {
            (0, response_1.sendError)(res, 'Password must be at least 8 characters long', 400);
            return;
        }
        // Hash the token
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Find user with this token
        const user = await models_1.User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
            deletedAt: null,
        });
        if (!user) {
            (0, response_1.sendError)(res, 'Invalid or expired invitation token', 400);
            return;
        }
        // Check if already activated
        if (user.status === types_1.UserStatus.ACTIVE && user.emailVerified) {
            (0, response_1.sendError)(res, 'This invitation has already been used', 400);
            return;
        }
        // Update user
        user.password = password;
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        user.status = types_1.UserStatus.ACTIVE;
        if (phone) {
            user.phone = phone;
        }
        let mfaQRCode = null;
        let mfaSecret = null;
        // Setup 2FA if requested
        if (enable2FA) {
            const secret = speakeasy_1.default.generateSecret({
                name: `RecuirtPro (${user.email})`,
                length: 32,
            });
            user.mfaSecret = secret.base32;
            user.mfaEnabled = true;
            // Generate QR code
            mfaQRCode = await qrcode_1.default.toDataURL(secret.otpauth_url);
            mfaSecret = secret.base32;
        }
        await user.save();
        // Create audit log
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.CREATE,
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
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: 'Welcome to RecuirtPro - Registration Complete',
                template: 'registrationComplete',
                data: {
                    name: user.firstName,
                    email: user.email,
                    role: user.role,
                    loginUrl: `${config_1.config.frontendUrl}/login`,
                    supportEmail: config_1.config.supportEmail || 'support@recuritpro.com',
                },
            });
        }
        catch (emailError) {
            logger_1.default.error('Failed to send welcome email:', emailError);
            // Don't fail the registration if email fails
        }
        logger_1.default.info(`HR registration completed: ${user.email}`);
        // Generate tokens
        const accessToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();
        (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        logger_1.default.error('Error completing HR registration:', error);
        (0, response_1.sendError)(res, 'Failed to complete registration', 500);
    }
};
exports.completeHRRegistration = completeHRRegistration;
/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/v1/hr/verify-2fa
 * @access  Public
 */
const verify2FA = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            (0, response_1.sendError)(res, 'Email and 2FA code are required', 400);
            return;
        }
        const user = await models_1.User.findOne({
            email: email.toLowerCase(),
            deletedAt: null,
        }).select('+mfaSecret');
        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            (0, response_1.sendError)(res, 'Invalid request', 400);
            return;
        }
        // Verify TOTP code
        const verified = speakeasy_1.default.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: code,
            window: 2, // Allow 2 time steps before and after
        });
        if (!verified) {
            (0, response_1.sendError)(res, 'Invalid 2FA code', 401);
            return;
        }
        // Create audit log
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.LOGIN,
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
        (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        logger_1.default.error('Error verifying 2FA:', error);
        (0, response_1.sendError)(res, 'Failed to verify 2FA code', 500);
    }
};
exports.verify2FA = verify2FA;
/**
 * @desc    Setup 2FA for existing user
 * @route   POST /api/v1/hr/setup-2fa
 * @access  Private
 */
const setup2FA = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await models_1.User.findOne({
            _id: userId,
            deletedAt: null,
        });
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        if (user.mfaEnabled) {
            (0, response_1.sendError)(res, '2FA is already enabled', 400);
            return;
        }
        // Generate secret
        const secret = speakeasy_1.default.generateSecret({
            name: `RecuirtPro (${user.email})`,
            length: 32,
        });
        // Generate QR code
        const qrCode = await qrcode_1.default.toDataURL(secret.otpauth_url);
        // Don't save yet - wait for verification
        (0, response_1.sendSuccess)(res, {
            qrCode,
            secret: secret.base32,
        }, '2FA setup initiated. Please scan the QR code and verify.');
    }
    catch (error) {
        logger_1.default.error('Error setting up 2FA:', error);
        (0, response_1.sendError)(res, 'Failed to setup 2FA', 500);
    }
};
exports.setup2FA = setup2FA;
/**
 * @desc    Confirm 2FA setup
 * @route   POST /api/v1/hr/confirm-2fa
 * @access  Private
 */
const confirm2FA = async (req, res) => {
    try {
        const { userId, secret, code } = req.body;
        if (!userId || !secret || !code) {
            (0, response_1.sendError)(res, 'User ID, secret, and verification code are required', 400);
            return;
        }
        const user = await models_1.User.findOne({
            _id: userId,
            deletedAt: null,
        });
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        // Verify the code
        const verified = speakeasy_1.default.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 2,
        });
        if (!verified) {
            (0, response_1.sendError)(res, 'Invalid verification code', 401);
            return;
        }
        // Save the secret and enable 2FA
        user.mfaSecret = secret;
        user.mfaEnabled = true;
        await user.save();
        // Create audit log
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.UPDATE,
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
        logger_1.default.info(`2FA enabled for user: ${user.email}`);
        (0, response_1.sendSuccess)(res, {
            mfaEnabled: true,
        }, '2FA enabled successfully');
    }
    catch (error) {
        logger_1.default.error('Error confirming 2FA:', error);
        (0, response_1.sendError)(res, 'Failed to confirm 2FA setup', 500);
    }
};
exports.confirm2FA = confirm2FA;
//# sourceMappingURL=hrRegistrationController.js.map