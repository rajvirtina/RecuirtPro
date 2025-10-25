/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import express from 'express';
import { body } from 'express-validator';
import {
  verifyInvitationToken,
  completeHRRegistration,
  verify2FA,
  setup2FA,
  confirm2FA,
} from '../controllers/hrRegistrationController';

const router = express.Router();

/**
 * @route   POST /api/v1/hr/verify-invitation
 * @desc    Verify HR invitation token
 * @access  Public
 */
router.post(
  '/verify-invitation',
  [body('token').notEmpty()],
  verifyInvitationToken
);

/**
 * @route   POST /api/v1/hr/complete-registration
 * @desc    Complete HR registration
 * @access  Public
 */
router.post(
  '/complete-registration',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
    body('phone').optional().isMobilePhone('any'),
    body('enable2FA').optional().isBoolean(),
  ],
  completeHRRegistration
);

/**
 * @route   POST /api/v1/hr/verify-2fa
 * @desc    Verify 2FA code during login
 * @access  Public
 */
router.post(
  '/verify-2fa',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }),
  ],
  verify2FA
);

/**
 * @route   POST /api/v1/hr/setup-2fa
 * @desc    Setup 2FA for existing user
 * @access  Private
 */
router.post(
  '/setup-2fa',
  [body('userId').notEmpty()],
  setup2FA
);

/**
 * @route   POST /api/v1/hr/confirm-2fa
 * @desc    Confirm 2FA setup
 * @access  Private
 */
router.post(
  '/confirm-2fa',
  [
    body('userId').notEmpty(),
    body('secret').notEmpty(),
    body('code').isLength({ min: 6, max: 6 }),
  ],
  confirm2FA
);

export default router;
