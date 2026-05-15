"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const interviewController = __importStar(require("../controllers/interviewController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/v1/interviews:
 *   post:
 *     summary: Schedule an interview
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Interview scheduled successfully
 */
router.post('/', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.body)('applicationId').notEmpty().isMongoId().withMessage('Valid application ID is required'),
    (0, express_validator_1.body)('jobId').notEmpty().isMongoId().withMessage('Valid job ID is required'),
    (0, express_validator_1.body)('candidateId').notEmpty().isMongoId().withMessage('Valid candidate ID is required'),
    (0, express_validator_1.body)('scheduledTime')
        .notEmpty().isISO8601().withMessage('Valid scheduled time is required')
        .custom((val) => {
        // VAL-005: Reject past dates
        if (new Date(val) <= new Date()) {
            throw new Error('Interview must be scheduled in the future');
        }
        return true;
    }),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15-480 minutes'),
    (0, express_validator_1.body)('mode').optional().isIn(['onsite', 'online', 'hybrid']),
    (0, express_validator_1.body)('location').optional().isString(),
    (0, express_validator_1.body)('meetingLink').optional().isURL().withMessage('Valid meeting link required'),
    (0, express_validator_1.body)('panel').optional().isArray(),
    (0, express_validator_1.body)('round').optional().isIn(['L1', 'L2', 'L3', 'HR', 'technical', 'managerial']),
    (0, express_validator_1.body)('interviewTemplateId').optional().isMongoId(),
], validator_1.validate, interviewController.scheduleInterview);
/**
 * @swagger
 * /api/v1/interviews:
 *   get:
 *     summary: Get all interviews
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interviews retrieved successfully
 */
router.get('/', auth_1.protect, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('jobId').optional().isMongoId(),
    (0, express_validator_1.query)('candidateId').optional().isMongoId(),
    (0, express_validator_1.query)('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled']),
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
], validator_1.validate, interviewController.getInterviews);
/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   get:
 *     summary: Get single interview by ID
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview retrieved successfully
 */
router.get('/:id', auth_1.protect, [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required')], validator_1.validate, interviewController.getInterviewById);
/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   put:
 *     summary: Update interview details
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview updated successfully
 */
router.put('/:id', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required'),
    (0, express_validator_1.body)('scheduledTime').optional().isISO8601(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 15, max: 480 }),
    (0, express_validator_1.body)('mode').optional().isIn(['onsite', 'online', 'hybrid']),
    (0, express_validator_1.body)('location').optional().isString(),
    (0, express_validator_1.body)('meetingLink').optional().isURL(),
    (0, express_validator_1.body)('panel').optional().isArray(),
    (0, express_validator_1.body)('instructions').optional().isString(),
], validator_1.validate, interviewController.updateInterview);
/**
 * @swagger
 * /api/v1/interviews/{id}/status:
 *   put:
 *     summary: Update interview status and add feedback
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview status updated
 */
router.put('/:id/status', auth_1.protect, [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required'),
    (0, express_validator_1.body)('status')
        .notEmpty()
        .isIn(['confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled'])
        .withMessage('Valid status is required'),
    (0, express_validator_1.body)('feedback').optional().isString().isLength({ max: 2000 }),
    (0, express_validator_1.body)('rating').optional().isInt({ min: 1, max: 5 }),
], validator_1.validate, interviewController.updateInterviewStatus);
/**
 * @swagger
 * /api/v1/interviews/{id}/start:
 *   post:
 *     summary: Start an interview (mark as in progress)
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview started successfully
 */
router.post('/:id/start', auth_1.protect, [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required')], validator_1.validate, interviewController.startInterview);
/**
 * @swagger
 * /api/v1/interviews/{id}/feedback:
 *   post:
 *     summary: Submit interview feedback and next round decision
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 */
router.post('/:id/feedback', auth_1.protect, [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required'),
    (0, express_validator_1.body)('rating').notEmpty().isInt({ min: 1, max: 5 }).withMessage('Rating (1-5) is required'),
    (0, express_validator_1.body)('comments').notEmpty().isString().isLength({ max: 2000 }).withMessage('Feedback comments are required'),
    (0, express_validator_1.body)('recommendation')
        .notEmpty()
        .isIn(['strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire'])
        .withMessage('Valid recommendation is required'),
    (0, express_validator_1.body)('finalDecision')
        .notEmpty()
        .isIn(['selected', 'rejected', 'on_hold'])
        .withMessage('Final decision for next round is required'),
], validator_1.validate, interviewController.submitInterviewFeedback);
/**
 * @swagger
 * /api/v1/interviews/{id}:
 *   delete:
 *     summary: Cancel interview
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview cancelled successfully
 */
router.delete('/:id', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Valid interview ID is required'),
    (0, express_validator_1.body)('reason').optional().isString().isLength({ max: 500 }),
], validator_1.validate, interviewController.cancelInterview);
exports.default = router;
//# sourceMappingURL=interviews.js.map