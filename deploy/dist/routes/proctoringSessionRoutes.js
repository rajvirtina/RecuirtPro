"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Session-based proctoring routes for the AI interview room.
 *
 * Public routes (no JWT — 64-char session token in the URL is the credential):
 *   POST /session/:sessionId/consent    — candidate grants/declines monitoring consent
 *   POST /session/:sessionId/violation  — real-time violation from browser monitor
 *
 * Protected routes (JWT required, HR/Admin/Employer):
 *   GET  /application/:applicationId/report — structured report for ApplicationDetail
 */
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const proctoringController_1 = require("../controllers/proctoringController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const SESSION_ID_PARAM = (0, express_validator_1.param)('sessionId')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid session ID format');
const APPLICATION_ID_PARAM = (0, express_validator_1.param)('applicationId')
    .isMongoId()
    .withMessage('Valid applicationId is required');
// ─── Public routes ────────────────────────────────────────────────────────────
/**
 * @route  POST /api/v1/proctoring/session/:sessionId/consent
 * @desc   Candidate grants or declines proctoring consent
 */
router.post('/session/:sessionId/consent', [
    SESSION_ID_PARAM,
    (0, express_validator_1.body)('consented').isBoolean().withMessage('consented must be a boolean'),
    (0, express_validator_1.body)('timestamp').optional().isISO8601(),
    (0, express_validator_1.body)('userAgent').optional().isString(),
], validator_1.validate, proctoringController_1.recordConsent);
/**
 * @route  POST /api/v1/proctoring/session/:sessionId/violation
 * @desc   Browser monitoring layer reports a real-time violation
 */
router.post('/session/:sessionId/violation', [
    SESSION_ID_PARAM,
    (0, express_validator_1.body)('type').notEmpty().isIn(['tab_switch', 'window_blur', 'multiple_faces', 'no_face', 'copy_attempt']),
    (0, express_validator_1.body)('severity').notEmpty().isIn(['low', 'medium', 'high', 'critical']),
    (0, express_validator_1.body)('timestamp').optional().isISO8601(),
    (0, express_validator_1.body)('screenshotBase64').optional().isString(),
], validator_1.validate, proctoringController_1.logSessionViolation);
// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(auth_1.protect);
/**
 * @route  GET /api/v1/proctoring/application/:applicationId/report
 * @desc   Full proctoring report for use in ApplicationDetail "Proctoring" tab
 */
router.get('/application/:applicationId/report', (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER), [APPLICATION_ID_PARAM], validator_1.validate, proctoringController_1.getProctoringReportByApplication);
exports.default = router;
//# sourceMappingURL=proctoringSessionRoutes.js.map