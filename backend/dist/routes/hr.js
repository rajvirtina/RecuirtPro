"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const hrRegistrationController_1 = require("../controllers/hrRegistrationController");
const router = express_1.default.Router();
/**
 * @route   POST /api/v1/hr/verify-invitation
 * @desc    Verify HR invitation token
 * @access  Public
 */
router.post('/verify-invitation', [(0, express_validator_1.body)('token').notEmpty()], hrRegistrationController_1.verifyInvitationToken);
/**
 * @route   POST /api/v1/hr/complete-registration
 * @desc    Complete HR registration
 * @access  Public
 */
router.post('/complete-registration', [
    (0, express_validator_1.body)('token').notEmpty(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }),
    (0, express_validator_1.body)('phone').optional().isMobilePhone('any'),
    (0, express_validator_1.body)('enable2FA').optional().isBoolean(),
], hrRegistrationController_1.completeHRRegistration);
/**
 * @route   POST /api/v1/hr/verify-2fa
 * @desc    Verify 2FA code during login
 * @access  Public
 */
router.post('/verify-2fa', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('code').isLength({ min: 6, max: 6 }),
], hrRegistrationController_1.verify2FA);
/**
 * @route   POST /api/v1/hr/setup-2fa
 * @desc    Setup 2FA for existing user
 * @access  Private
 */
router.post('/setup-2fa', [(0, express_validator_1.body)('userId').notEmpty()], hrRegistrationController_1.setup2FA);
/**
 * @route   POST /api/v1/hr/confirm-2fa
 * @desc    Confirm 2FA setup
 * @access  Private
 */
router.post('/confirm-2fa', [
    (0, express_validator_1.body)('userId').notEmpty(),
    (0, express_validator_1.body)('secret').notEmpty(),
    (0, express_validator_1.body)('code').isLength({ min: 6, max: 6 }),
], hrRegistrationController_1.confirm2FA);
exports.default = router;
//# sourceMappingURL=hr.js.map