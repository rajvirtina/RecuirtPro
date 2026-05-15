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
const applicationController = __importStar(require("../controllers/applicationController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     summary: Submit a job application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *             properties:
 *               jobId:
 *                 type: string
 *               coverLetter:
 *                 type: string
 *               resumeUrl:
 *                 type: string
 *               expectedSalary:
 *                 type: number
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *       400:
 *         description: Already applied or job not active
 *       404:
 *         description: Job not found
 */
router.post('/', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.CANDIDATE), upload_1.uploadResume.single('resume'), upload_1.handleUploadError, [
    (0, express_validator_1.body)('jobId').notEmpty().isMongoId().withMessage('Valid job ID is required'),
    (0, express_validator_1.body)('coverLetter').optional().isString().isLength({ max: 2000 }),
    (0, express_validator_1.body)('resumeUrl').optional().isURL().withMessage('Valid resume URL required'),
    (0, express_validator_1.body)('expectedSalary').optional().isNumeric().withMessage('Expected salary must be a number'),
], validator_1.validate, applicationController.submitApplication);
/**
 * @swagger
 * /api/v1/applications/check/{jobId}:
 *   get:
 *     summary: Check if candidate has applied to a job
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application status retrieved
 */
router.get('/check/:jobId', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.CANDIDATE), [(0, express_validator_1.param)('jobId').isMongoId().withMessage('Valid job ID is required')], validator_1.validate, applicationController.checkApplicationStatus);
/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     summary: Get all applications (filtered by role)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitted, screening, shortlisted, rejected, interviewing, offered, hired, withdrawn]
 *       - in: query
 *         name: candidateId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 */
router.get('/', auth_1.protect, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('jobId').optional().isMongoId(),
    (0, express_validator_1.query)('status').optional().isIn([
        'applied',
        'shortlisted',
        'interview_scheduled',
        'in_progress',
        'selected',
        'hired',
        'offer_released',
        'rejected',
        'on_hold',
        'withdrawn',
    ]),
    (0, express_validator_1.query)('candidateId').optional().isMongoId(),
], validator_1.validate, applicationController.getApplications);
/**
 * @swagger
 * /api/v1/applications/stats:
 *   get:
 *     summary: Get application statistics
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [(0, express_validator_1.query)('jobId').optional().isMongoId()], validator_1.validate, applicationController.getApplicationStats);
/**
 * @swagger
 * /api/v1/applications/{id}:
 *   get:
 *     summary: Get single application by ID
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application retrieved successfully
 *       404:
 *         description: Application not found
 */
router.get('/:id', auth_1.protect, [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid application ID is required')], validator_1.validate, applicationController.getApplicationById);
/**
 * @swagger
 * /api/v1/applications/{id}/status:
 *   put:
 *     summary: Update application status
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [screening, shortlisted, rejected, interviewing, offered, hired]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application status updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Application not found
 */
router.put('/:id/status', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Valid application ID is required'),
    (0, express_validator_1.body)('status')
        .notEmpty()
        .isIn(['shortlisted', 'interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released', 'rejected', 'on_hold'])
        .withMessage('Valid status is required'),
    (0, express_validator_1.body)('notes').optional().isString().isLength({ max: 1000 }),
], validator_1.validate, applicationController.updateApplicationStatus);
/**
 * @swagger
 * /api/v1/applications/{id}:
 *   delete:
 *     summary: Withdraw application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application withdrawn successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Application not found
 */
router.delete('/:id', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.CANDIDATE), [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid application ID is required')], validator_1.validate, applicationController.withdrawApplication);
/**
 * @swagger
 * /api/v1/applications/{id}/resume:
 *   get:
 *     summary: Download resume for an application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resume file
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Resume not found
 */
router.get('/:id/resume', auth_1.protect, [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid application ID is required')], validator_1.validate, applicationController.downloadResume);
exports.default = router;
//# sourceMappingURL=applications.js.map