"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const aiInterviewController_1 = require("../controllers/aiInterviewController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// ─── Protected (HR/Admin): manage sessions ────────────────────────────────────
/**
 * @route  POST /api/v1/ai-interviews
 * @desc   Create an AI interview session for a scheduled interview
 * @access HR / Admin / Employer
 */
router.post('/', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER), [
    (0, express_validator_1.body)('interviewId').notEmpty().isMongoId().withMessage('Valid interviewId is required'),
    (0, express_validator_1.body)('difficulty').optional().isIn(['junior', 'senior', 'expert']),
    (0, express_validator_1.body)('numQuestions').optional().isInt({ min: 3, max: 12 }),
], validator_1.validate, aiInterviewController_1.createSession);
/**
 * @route  GET /api/v1/ai-interviews/:interviewId/session
 * @desc   HR/Admin review of a completed AI session
 * @access HR / Admin
 */
router.get('/:interviewId/session', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER), [(0, express_validator_1.param)('interviewId').isMongoId().withMessage('Valid interviewId is required')], validator_1.validate, aiInterviewController_1.getSessionForReview);
// ─── Public (session token = credential): candidate interview flow ─────────────
/**
 * @route  GET /api/v1/ai-interviews/session/:sessionId
 * @desc   Fetch session metadata — no auth required
 */
router.get('/session/:sessionId', [(0, express_validator_1.param)('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID')], validator_1.validate, aiInterviewController_1.getSession);
/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/start
 * @desc   Candidate gives consent + triggers question generation
 */
router.post('/session/:sessionId/start', [
    (0, express_validator_1.param)('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID'),
    (0, express_validator_1.body)('consentGiven').isBoolean().withMessage('consentGiven must be a boolean'),
], validator_1.validate, aiInterviewController_1.startSession);
/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/answer
 * @desc   Submit candidate response; evaluates and returns next question
 */
router.post('/session/:sessionId/answer', [
    (0, express_validator_1.param)('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID'),
    (0, express_validator_1.body)('questionId').notEmpty().withMessage('questionId is required'),
    (0, express_validator_1.body)('responseText').notEmpty().trim().isLength({ min: 1, max: 3000 }).withMessage('responseText is required (max 3000 chars)'),
    (0, express_validator_1.body)('responseTimeSeconds').optional().isInt({ min: 0, max: 3600 }),
], validator_1.validate, aiInterviewController_1.submitAnswer);
/**
 * @route  POST /api/v1/ai-interviews/session/:sessionId/complete
 * @desc   Explicitly close a session (early exit / connection drop)
 */
router.post('/session/:sessionId/complete', [(0, express_validator_1.param)('sessionId').isLength({ min: 64, max: 64 }).withMessage('Invalid session ID')], validator_1.validate, aiInterviewController_1.completeSession);
exports.default = router;
//# sourceMappingURL=aiInterviewRoutes.js.map