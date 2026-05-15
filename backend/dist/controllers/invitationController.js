"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendInvitation = exports.getInvitations = exports.verifyInvitationToken = exports.sendCandidateInvitation = void 0;
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("../services/emailService");
/**
 * @desc    Send candidate invitation
 * @route   POST /api/v1/invitations/send
 * @access  Private (HR/Employer/Admin)
 */
const sendCandidateInvitation = async (req, res) => {
    try {
        const { email, jobId } = req.body;
        if (!email) {
            return (0, response_1.sendError)(res, 'Email is required', 400);
        }
        // Check if user already exists
        const existingUser = await models_1.User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return (0, response_1.sendError)(res, 'User with this email already exists', 400);
        }
        // Check if invitation already sent
        const existingInvitation = await models_1.Invitation.findOne({
            email: email.toLowerCase(),
            companyId: req.user?.companyId,
            status: 'pending',
            expiresAt: { $gt: new Date() },
        });
        if (existingInvitation) {
            return (0, response_1.sendError)(res, 'Invitation already sent to this email', 400);
        }
        // Generate unique token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        // Set expiry to 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // Create invitation
        const invitation = await models_1.Invitation.create({
            email: email.toLowerCase(),
            companyId: req.user?.companyId,
            invitedBy: req.user?._id,
            token,
            role: 'candidate',
            status: 'pending',
            expiresAt,
        });
        // Get company details
        const inviter = await models_1.User.findById(req.user?._id).populate('companyId');
        const companyName = inviter?.companyId?.name || 'Our Company';
        // Send invitation email
        const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${token}${jobId ? `&jobId=${jobId}` : ''}`;
        try {
            await (0, emailService_1.sendEmail)({
                to: email,
                subject: `Invitation to Apply at ${companyName}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You're Invited to Apply!</h2>
            <p>Hello,</p>
            <p>You have been invited by ${companyName} to apply for positions on our recruitment platform.</p>
            <p>Click the button below to create your account and start applying:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Create Account & Apply
              </a>
            </div>
            <p>This invitation will expire in 7 days.</p>
            <p>Best regards,<br/>${companyName} Team</p>
          </div>
        `,
            });
        }
        catch (emailError) {
            logger_1.default.error('Error sending invitation email:', emailError);
            // Don't fail the request if email fails, just log it
        }
        logger_1.default.info(`Candidate invitation sent to ${email} by ${req.user?._id}`);
        return (0, response_1.sendSuccess)(res, {
            ...invitation.toObject(),
            invitationLink, // Include link in response for testing
        }, 'Invitation sent successfully', 201);
    }
    catch (error) {
        logger_1.default.error('Error in sendCandidateInvitation:', error);
        return (0, response_1.sendError)(res, error.message || 'Error sending invitation', 500);
    }
};
exports.sendCandidateInvitation = sendCandidateInvitation;
/**
 * @desc    Verify invitation token
 * @route   GET /api/v1/invitations/verify/:token
 * @access  Public
 */
const verifyInvitationToken = async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await models_1.Invitation.findOne({ token })
            .populate('companyId', 'name logo')
            .populate('invitedBy', 'firstName lastName');
        if (!invitation) {
            return (0, response_1.sendError)(res, 'Invalid invitation token', 404);
        }
        if (invitation.status === 'accepted') {
            return (0, response_1.sendError)(res, 'Invitation has already been used', 400);
        }
        if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
            invitation.status = 'expired';
            await invitation.save();
            return (0, response_1.sendError)(res, 'Invitation has expired', 400);
        }
        return (0, response_1.sendSuccess)(res, invitation, 'Invitation is valid');
    }
    catch (error) {
        logger_1.default.error('Error in verifyInvitationToken:', error);
        return (0, response_1.sendError)(res, error.message || 'Error verifying invitation', 500);
    }
};
exports.verifyInvitationToken = verifyInvitationToken;
/**
 * @desc    Get all invitations
 * @route   GET /api/v1/invitations
 * @access  Private (HR/Employer/Admin)
 */
const getInvitations = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = { companyId: req.user?.companyId };
        if (status) {
            query.status = status;
        }
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const skip = (pageNum - 1) * limitNum;
        const [invitations, total] = await Promise.all([
            models_1.Invitation.find(query)
                .populate('invitedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            models_1.Invitation.countDocuments(query),
        ]);
        return (0, response_1.sendPaginatedResponse)(res, invitations, pageNum, limitNum, total, 'Invitations retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getInvitations:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching invitations', 500);
    }
};
exports.getInvitations = getInvitations;
/**
 * @desc    Resend invitation
 * @route   POST /api/v1/invitations/:id/resend
 * @access  Private (HR/Employer/Admin)
 */
const resendInvitation = async (req, res) => {
    try {
        const { id } = req.params;
        const invitation = await models_1.Invitation.findById(id);
        if (!invitation) {
            return (0, response_1.sendError)(res, 'Invitation not found', 404);
        }
        if (invitation.companyId.toString() !== req.user?.companyId) {
            return (0, response_1.sendError)(res, 'Not authorized', 403);
        }
        if (invitation.status === 'accepted') {
            return (0, response_1.sendError)(res, 'Invitation has already been accepted', 400);
        }
        // Extend expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        invitation.expiresAt = expiresAt;
        invitation.status = 'pending';
        await invitation.save();
        // Resend email
        const inviter = await models_1.User.findById(req.user?._id).populate('companyId');
        const companyName = inviter?.companyId?.name || 'Our Company';
        const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${invitation.token}`;
        try {
            await (0, emailService_1.sendEmail)({
                to: invitation.email,
                subject: `Reminder: Invitation to Apply at ${companyName}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invitation Reminder</h2>
            <p>Hello,</p>
            <p>This is a reminder that you have been invited by ${companyName} to apply for positions on our recruitment platform.</p>
            <p>Click the button below to create your account and start applying:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Create Account & Apply
              </a>
            </div>
            <p>This invitation will expire in 7 days.</p>
            <p>Best regards,<br/>${companyName} Team</p>
          </div>
        `,
            });
        }
        catch (emailError) {
            logger_1.default.error('Error sending reminder email:', emailError);
        }
        logger_1.default.info(`Invitation resent to ${invitation.email}`);
        return (0, response_1.sendSuccess)(res, invitation, 'Invitation resent successfully');
    }
    catch (error) {
        logger_1.default.error('Error in resendInvitation:', error);
        return (0, response_1.sendError)(res, error.message || 'Error resending invitation', 500);
    }
};
exports.resendInvitation = resendInvitation;
//# sourceMappingURL=invitationController.js.map