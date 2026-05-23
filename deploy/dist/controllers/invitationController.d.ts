import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Send candidate invitation
 * @route   POST /api/v1/invitations/send
 * @access  Private (HR/Employer/Admin)
 */
export declare const sendCandidateInvitation: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Verify invitation token
 * @route   GET /api/v1/invitations/verify/:token
 * @access  Public
 */
export declare const verifyInvitationToken: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get all invitations
 * @route   GET /api/v1/invitations
 * @access  Private (HR/Employer/Admin)
 */
export declare const getInvitations: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Resend invitation
 * @route   POST /api/v1/invitations/:id/resend
 * @access  Private (HR/Employer/Admin)
 */
export declare const resendInvitation: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=invitationController.d.ts.map