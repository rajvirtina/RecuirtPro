/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
import { Request, Response } from 'express';
/**
 * @desc    Verify HR invitation token
 * @route   POST /api/v1/hr/verify-invitation
 * @access  Public
 */
export declare const verifyInvitationToken: (req: Request, res: Response) => Promise<void>;
/**
 * @desc    Complete HR registration
 * @route   POST /api/v1/hr/complete-registration
 * @access  Public
 */
export declare const completeHRRegistration: (req: Request, res: Response) => Promise<void>;
/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/v1/hr/verify-2fa
 * @access  Public
 */
export declare const verify2FA: (req: Request, res: Response) => Promise<void>;
/**
 * @desc    Setup 2FA for existing user
 * @route   POST /api/v1/hr/setup-2fa
 * @access  Private
 */
export declare const setup2FA: (req: Request, res: Response) => Promise<void>;
/**
 * @desc    Confirm 2FA setup
 * @route   POST /api/v1/hr/confirm-2fa
 * @access  Private
 */
export declare const confirm2FA: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=hrRegistrationController.d.ts.map