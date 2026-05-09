import { Response } from 'express';
import crypto from 'crypto';
import { Invitation, User } from '../models';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import logger from '../utils/logger';
import { sendEmail } from '../services/emailService';

/**
 * @desc    Send candidate invitation
 * @route   POST /api/v1/invitations/send
 * @access  Private (HR/Employer/Admin)
 */
export const sendCandidateInvitation = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { email, jobId } = req.body;

    if (!email) {
      return sendError(res, 'Email is required', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Check if invitation already sent
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      companyId: req.user?.companyId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingInvitation) {
      return sendError(res, 'Invitation already sent to this email', 400);
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiry to 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const invitation = await Invitation.create({
      email: email.toLowerCase(),
      companyId: req.user?.companyId,
      invitedBy: req.user?._id,
      token,
      role: 'candidate',
      status: 'pending',
      expiresAt,
    });

    // Get company details
    const inviter = await User.findById(req.user?._id).populate('companyId');
    const companyName = (inviter as any)?.companyId?.name || 'Our Company';

    // Send invitation email
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${token}${jobId ? `&jobId=${jobId}` : ''}`;
    
    try {
      await sendEmail({
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
    } catch (emailError) {
      logger.error('Error sending invitation email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    logger.info(`Candidate invitation sent to ${email} by ${req.user?._id}`);

    return sendSuccess(res, {
      ...invitation.toObject(),
      invitationLink, // Include link in response for testing
    }, 'Invitation sent successfully', 201);
  } catch (error: any) {
    logger.error('Error in sendCandidateInvitation:', error);
    return sendError(res, error.message || 'Error sending invitation', 500);
  }
};

/**
 * @desc    Verify invitation token
 * @route   GET /api/v1/invitations/verify/:token
 * @access  Public
 */
export const verifyInvitationToken = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findOne({ token })
      .populate('companyId', 'name logo')
      .populate('invitedBy', 'firstName lastName');

    if (!invitation) {
      return sendError(res, 'Invalid invitation token', 404);
    }

    if (invitation.status === 'accepted') {
      return sendError(res, 'Invitation has already been used', 400);
    }

    if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return sendError(res, 'Invitation has expired', 400);
    }

    return sendSuccess(res, invitation, 'Invitation is valid');
  } catch (error: any) {
    logger.error('Error in verifyInvitationToken:', error);
    return sendError(res, error.message || 'Error verifying invitation', 500);
  }
};

/**
 * @desc    Get all invitations
 * @route   GET /api/v1/invitations
 * @access  Private (HR/Employer/Admin)
 */
export const getInvitations = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { companyId: req.user?.companyId };
    
    if (status) {
      query.status = status;
    }

    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const [invitations, total] = await Promise.all([
      Invitation.find(query)
        .populate('invitedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Invitation.countDocuments(query),
    ]);

    return sendPaginatedResponse(
      res,
      invitations,
      pageNum,
      limitNum,
      total,
      'Invitations retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getInvitations:', error);
    return sendError(res, error.message || 'Error fetching invitations', 500);
  }
};

/**
 * @desc    Resend invitation
 * @route   POST /api/v1/invitations/:id/resend
 * @access  Private (HR/Employer/Admin)
 */
export const resendInvitation = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id);

    if (!invitation) {
      return sendError(res, 'Invitation not found', 404);
    }

    if (invitation.companyId.toString() !== req.user?.companyId) {
      return sendError(res, 'Not authorized', 403);
    }

    if (invitation.status === 'accepted') {
      return sendError(res, 'Invitation has already been accepted', 400);
    }

    // Extend expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    invitation.expiresAt = expiresAt;
    invitation.status = 'pending';
    await invitation.save();

    // Resend email
    const inviter = await User.findById(req.user?._id).populate('companyId');
    const companyName = (inviter as any)?.companyId?.name || 'Our Company';
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${invitation.token}`;
    
    try {
      await sendEmail({
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
    } catch (emailError) {
      logger.error('Error sending reminder email:', emailError);
    }

    logger.info(`Invitation resent to ${invitation.email}`);

    return sendSuccess(res, invitation, 'Invitation resent successfully');
  } catch (error: any) {
    logger.error('Error in resendInvitation:', error);
    return sendError(res, error.message || 'Error resending invitation', 500);
  }
};
