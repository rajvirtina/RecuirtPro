"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendVerification = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.verifyEmail = exports.refresh = exports.logout = exports.getMe = exports.login = exports.register = void 0;
const express_validator_1 = require("express-validator");
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("../services/emailService");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const types_1 = require("../types");
const AuditLog_1 = require("../models/AuditLog");
/* ── BUG-001: httpOnly cookie helpers ─────────────────────────── */
const COOKIE_OPTS = {
    httpOnly: true,
    secure: config_1.config.env === 'production',
    sameSite: 'strict',
};
/** Set the access-token httpOnly cookie (15 min) */
function setAccessCookie(res, token) {
    res.cookie('accessToken', token, {
        ...COOKIE_OPTS,
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
}
/** Set the refresh-token httpOnly cookie (7 days) */
function setRefreshCookie(res, token) {
    res.cookie('refreshToken', token, {
        ...COOKIE_OPTS,
        path: '/api/v1/auth/refresh', // only sent to refresh endpoint
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}
/** Set a readable CSRF token (non-httpOnly — readable by JS for X-CSRF-Token header) */
function setCsrfCookie(res) {
    const csrf = crypto_1.default.randomBytes(32).toString('hex');
    res.cookie('csrfToken', csrf, {
        secure: config_1.config.env === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return csrf;
}
/** Clear all auth cookies on logout */
function clearAuthCookies(res) {
    res.clearCookie('accessToken', COOKIE_OPTS);
    res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/api/v1/auth/refresh' });
    res.clearCookie('csrfToken');
}
/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            (0, response_1.sendError)(res, 'Validation failed', 400, errors.array());
            return;
        }
        const { email, password, firstName, lastName, role, phoneNumber, invitationToken, companySlug } = req.body;
        // Check if user already exists
        const existingUser = await models_1.User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            (0, response_1.sendError)(res, 'User with this email already exists', 409);
            return;
        }
        let userRole = 'candidate';
        let companyId;
        // Handle invitation-based registration
        if (invitationToken) {
            const invitation = await models_1.Invitation.findOne({ token: invitationToken });
            if (!invitation) {
                (0, response_1.sendError)(res, 'Invalid invitation token', 400);
                return;
            }
            if (invitation.status === 'accepted') {
                (0, response_1.sendError)(res, 'Invitation has already been used', 400);
                return;
            }
            if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
                invitation.status = 'expired';
                await invitation.save();
                (0, response_1.sendError)(res, 'Invitation has expired', 400);
                return;
            }
            if (invitation.email.toLowerCase() !== email.toLowerCase()) {
                (0, response_1.sendError)(res, 'Email does not match invitation', 400);
                return;
            }
            userRole = invitation.role;
            companyId = invitation.companyId?.toString();
            // Mark invitation as accepted
            invitation.status = 'accepted';
            invitation.acceptedAt = new Date();
            await invitation.save();
        }
        else {
            // Non-invited registration
            // Block employer/HR/admin/interviewer registration - they must be invited
            const restrictedRoles = ['employer', 'hr', 'admin', 'interviewer'];
            if (role && restrictedRoles.includes(role.toLowerCase())) {
                (0, response_1.sendError)(res, 'This role requires an invitation from an administrator. Please contact support.', 403);
                return;
            }
            // Candidates must register under a specific company using its company code (slug)
            if (!role || role === 'candidate') {
                if (!companySlug) {
                    (0, response_1.sendError)(res, 'Company code is required to register as a candidate. Please enter your company\'s code.', 400);
                    return;
                }
                const company = await models_1.Company.findOne({
                    slug: companySlug.trim().toLowerCase(),
                    deletedAt: null,
                    status: 'active',
                });
                if (!company) {
                    (0, response_1.sendError)(res, 'Invalid company code. Please verify the code with your recruiter and try again.', 400);
                    return;
                }
                companyId = company._id.toString();
            }
        }
        // Create user
        const user = await models_1.User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: userRole,
            phoneNumber,
            companyId,
        });
        // Check if email verification is enabled
        const emailVerificationEnabled = config_1.config.features.emailVerification;
        if (emailVerificationEnabled) {
            const skipEmail = process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true';
            if (skipEmail) {
                // Dev mode with SKIP_EMAIL: auto-activate since no real email is sent
                logger_1.default.info('Development mode (SKIP_EMAIL): Auto-activating user');
                user.status = types_1.UserStatus.ACTIVE;
                user.emailVerified = true;
                await user.save();
            }
            else {
                // Generate email verification token
                const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
                user.emailVerificationToken = crypto_1.default
                    .createHash('sha256')
                    .update(verificationToken)
                    .digest('hex');
                user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                // Send verification email
                const verificationUrl = `${config_1.config.frontendUrl}/verify-email?token=${verificationToken}`;
                try {
                    await (0, emailService_1.sendEmail)({
                        to: user.email,
                        subject: 'Verify Your Email - RecuirtPro',
                        template: 'emailVerification',
                        data: {
                            name: user.firstName,
                            verificationUrl,
                        },
                    });
                    await user.save();
                }
                catch (emailError) {
                    logger_1.default.error('Failed to send verification email:', emailError);
                    // In development, auto-activate if email fails
                    if (config_1.config.env === 'development') {
                        logger_1.default.info('Development mode: Auto-activating user due to email failure');
                        user.status = types_1.UserStatus.ACTIVE;
                        user.emailVerified = true;
                        await user.save();
                    }
                }
            }
        }
        else {
            // Email verification disabled - auto-activate
            logger_1.default.info('Email verification disabled: Auto-activating user');
            user.status = types_1.UserStatus.ACTIVE;
            user.emailVerified = true;
            await user.save();
        }
        // Generate tokens
        const accessToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();
        // BUG-001: Set httpOnly auth cookies
        setAccessCookie(res, accessToken);
        setRefreshCookie(res, refreshToken);
        const csrfToken = setCsrfCookie(res);
        logger_1.default.info(`New user registered: ${user.email}`);
        (0, response_1.sendSuccess)(res, {
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
            csrfToken,
        }, 'Registration successful. Please check your email to verify your account.', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            (0, response_1.sendError)(res, 'Validation failed', 400, errors.array());
            return;
        }
        const { email, password } = req.body;
        // Find user by credentials
        const user = await models_1.User.findByCredentials(email, password);
        if (!user) {
            (0, response_1.sendError)(res, 'Invalid email or password', 401);
            return;
        }
        // Check if user is soft-deleted
        if (user.deletedAt) {
            (0, response_1.sendError)(res, 'Your account has been deactivated. Please contact support.', 403);
            return;
        }
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        // Generate tokens
        const accessToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();
        // BUG-001: Set httpOnly cookies + CSRF token
        setAccessCookie(res, accessToken);
        setRefreshCookie(res, refreshToken);
        const csrfToken = setCsrfCookie(res);
        logger_1.default.info(`User logged in: ${user.email}`);
        (0, response_1.sendSuccess)(res, {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                companyId: user.companyId,
                emailVerified: user.emailVerified,
                isMfaEnabled: user.mfaEnabled || false,
            },
            // Still return tokens in body for backwards-compatibility with mobile/API clients
            accessToken,
            refreshToken,
            csrfToken,
        }, 'Login successful');
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
    try {
        const user = await models_1.User.findById(req.user?._id).select('-password');
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        (0, response_1.sendSuccess)(res, { user }, 'User retrieved successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
    try {
        // Invalidate all refresh tokens for this user
        const user = await models_1.User.findById(req.user?._id);
        if (user) {
            await user.invalidateRefreshTokens();
        }
        // BUG-001: Clear httpOnly auth cookies
        clearAuthCookies(res);
        logger_1.default.info(`User logged out: ${req.user?.email}`);
        (0, response_1.sendSuccess)(res, null, 'Logout successful');
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
const refresh = async (req, res, next) => {
    try {
        // BUG-001: Accept refresh token from httpOnly cookie first, then body fallback
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            (0, response_1.sendError)(res, 'Refresh token is required', 401);
            return;
        }
        const decoded = await models_1.User.verifyRefreshToken(refreshToken);
        const user = await models_1.User.findById(decoded.id);
        if (!user || user.deletedAt) {
            (0, response_1.sendError)(res, 'Invalid refresh token', 401);
            return;
        }
        // Generate new access token + rotate refresh token
        const accessToken = user.generateAuthToken();
        const newRefreshToken = user.generateRefreshToken();
        // BUG-001: Rotate cookies
        setAccessCookie(res, accessToken);
        setRefreshCookie(res, newRefreshToken);
        const csrfToken = setCsrfCookie(res);
        (0, response_1.sendSuccess)(res, { accessToken, csrfToken }, 'Token refreshed successfully');
    }
    catch {
        (0, response_1.sendError)(res, 'Invalid or expired refresh token', 401);
    }
};
exports.refresh = refresh;
/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) {
            (0, response_1.sendError)(res, 'Verification token is required', 400);
            return;
        }
        // Hash the token
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Find user with this token
        const user = await models_1.User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        });
        if (!user) {
            (0, response_1.sendError)(res, 'Invalid or expired verification token', 400);
            return;
        }
        // Mark email as verified and activate user if pending
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        if (user.status === types_1.UserStatus.PENDING_VERIFICATION) {
            user.status = types_1.UserStatus.ACTIVE;
        }
        await user.save();
        logger_1.default.info(`Email verified: ${user.email}`);
        (0, response_1.sendSuccess)(res, {
            user: {
                id: user._id,
                email: user.email,
                emailVerified: user.emailVerified,
            },
        }, 'Email verified successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        // Rate limiting check - 5 attempts per hour per email
        const rateLimitKey = `${email.toLowerCase()}_${ipAddress}`;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        let rateLimitLog = await models_1.RateLimitLog.findOne({
            identifier: rateLimitKey,
            action: 'password_reset',
            createdAt: { $gte: oneHourAgo },
        });
        // Check if blocked
        if (rateLimitLog?.blockedUntil && rateLimitLog.blockedUntil > new Date()) {
            const minutesLeft = Math.ceil((rateLimitLog.blockedUntil.getTime() - Date.now()) / 60000);
            logger_1.default.warn(`Password reset blocked for ${email} from ${ipAddress}. Blocked for ${minutesLeft} more minutes.`);
            (0, response_1.sendError)(res, `Too many password reset attempts. Please try again in ${minutesLeft} minutes.`, 429);
            return;
        }
        // Check attempt count
        if (rateLimitLog) {
            if (rateLimitLog.attempts >= 5) {
                // Block for 1 hour
                rateLimitLog.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
                rateLimitLog.lastAttempt = new Date();
                await rateLimitLog.save();
                logger_1.default.warn(`Password reset rate limit exceeded for ${email} from ${ipAddress}`);
                (0, response_1.sendError)(res, 'Too many password reset attempts. Please try again in 1 hour.', 429);
                return;
            }
            // Increment attempts
            rateLimitLog.attempts += 1;
            rateLimitLog.lastAttempt = new Date();
            await rateLimitLog.save();
        }
        else {
            // Create new rate limit log
            rateLimitLog = await models_1.RateLimitLog.create({
                identifier: rateLimitKey,
                action: 'password_reset',
                attempts: 1,
                ipAddress,
                userAgent: req.get('user-agent'),
            });
        }
        const user = await models_1.User.findOne({ email: email.toLowerCase(), deletedAt: null }).select('+passwordResetToken +passwordResetExpires');
        if (!user) {
            // Don't reveal if user exists or not for security
            logger_1.default.info(`Password reset requested for non-existent email: ${email}`);
            (0, response_1.sendSuccess)(res, null, 'If an account exists with that email, a password reset link has been sent.');
            return;
        }
        // Invalidate any previous reset tokens
        if (user.passwordResetToken) {
            logger_1.default.info(`Invalidating previous reset token for: ${user.email}`);
        }
        // Generate reset token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto_1.default
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();
        // Create audit log
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.PASSWORD_CHANGE,
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
        const resetUrl = `${config_1.config.frontendUrl}/reset-password?token=${resetToken}`;
        try {
            await (0, emailService_1.sendEmail)({
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
            logger_1.default.info(`Password reset email sent to: ${user.email} from IP: ${ipAddress}`);
        }
        catch (emailError) {
            logger_1.default.error('Failed to send password reset email:', emailError);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            (0, response_1.sendError)(res, 'Failed to send password reset email. Please try again later.', 500);
            return;
        }
        (0, response_1.sendSuccess)(res, null, 'If an account exists with that email, a password reset link has been sent.');
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        if (!token || !password) {
            (0, response_1.sendError)(res, 'Token and new password are required', 400);
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
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            deletedAt: null,
        }).select('+passwordResetToken +passwordResetExpires');
        if (!user) {
            logger_1.default.warn(`Invalid or expired reset token attempt from IP: ${ipAddress}`);
            (0, response_1.sendError)(res, 'Invalid or expired reset token', 400);
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
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.PASSWORD_CHANGE,
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
        logger_1.default.info(`Password reset successful for: ${user.email} from IP: ${ipAddress}`);
        // Send confirmation email
        try {
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: 'Password Changed Successfully - RecuirtPro',
                template: 'passwordChanged',
                data: {
                    name: user.firstName,
                    timestamp: new Date().toLocaleString(),
                    ipAddress,
                },
            });
        }
        catch (emailError) {
            logger_1.default.error('Failed to send password changed email:', emailError);
        }
        // Clear rate limit logs for this user
        await models_1.RateLimitLog.deleteMany({
            identifier: { $regex: user.email.toLowerCase(), $options: 'i' },
            action: 'password_reset',
        });
        (0, response_1.sendSuccess)(res, null, 'Password reset successful. Please login with your new password.');
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
/**
 * @desc    Change password
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        if (!currentPassword || !newPassword) {
            (0, response_1.sendError)(res, 'Current password and new password are required', 400);
            return;
        }
        // Password policy validation
        if (newPassword.length < 8) {
            (0, response_1.sendError)(res, 'Password must be at least 8 characters long', 400);
            return;
        }
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
            (0, response_1.sendError)(res, 'Password must contain uppercase, lowercase, number, and special character', 400);
            return;
        }
        const user = await models_1.User.findById(req.user?._id);
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            (0, response_1.sendError)(res, 'Current password is incorrect', 401);
            return;
        }
        // Update password
        user.password = newPassword;
        await user.save();
        // Invalidate all existing sessions/refresh tokens
        await user.invalidateRefreshTokens();
        // Create audit log
        await AuditLog_1.AuditLog.create({
            userId: user._id,
            action: types_1.AuditAction.PASSWORD_CHANGE,
            resource: 'User',
            resourceId: user._id.toString(),
            description: `Password changed by user: ${user.email}`,
            metadata: { action: 'password_changed' },
            ipAddress,
            userAgent: req.get('user-agent'),
        });
        // Send confirmation email
        try {
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: 'Password Changed Successfully - RecuirtPro',
                template: 'passwordChanged',
                data: {
                    name: user.firstName,
                    timestamp: new Date().toLocaleString(),
                    ipAddress,
                },
            });
        }
        catch (emailError) {
            logger_1.default.error('Failed to send password changed email:', emailError);
        }
        logger_1.default.info(`Password changed: ${user.email}`);
        (0, response_1.sendSuccess)(res, null, 'Password changed successfully. Please login again.');
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Private
 */
const resendVerification = async (req, res, next) => {
    try {
        const user = await models_1.User.findById(req.user?._id);
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        if (user.emailVerified) {
            (0, response_1.sendError)(res, 'Email is already verified', 400);
            return;
        }
        // Generate new verification token
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        user.emailVerificationToken = crypto_1.default
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await user.save();
        // Send verification email
        const verificationUrl = `${config_1.config.frontendUrl}/verify-email?token=${verificationToken}`;
        await (0, emailService_1.sendEmail)({
            to: user.email,
            subject: 'Verify Your Email - RecuirtPro',
            template: 'emailVerification',
            data: {
                name: user.firstName,
                verificationUrl,
            },
        });
        logger_1.default.info(`Verification email resent to: ${user.email}`);
        (0, response_1.sendSuccess)(res, null, 'Verification email sent successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.resendVerification = resendVerification;
//# sourceMappingURL=authController.js.map