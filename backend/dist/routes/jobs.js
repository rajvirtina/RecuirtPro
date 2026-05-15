"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const jobController_1 = require("../controllers/jobController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/v1/jobs
 * @desc    Get all jobs with filters
 * @access  Public (optionalAuth - filters by company if authenticated HR/employer)
 */
router.get('/', auth_1.optionalAuth, jobController_1.getJobs);
/**
 * @route   GET /api/v1/jobs/company/:slug/info
 * @desc    Get public company info by slug (used for registration lookup)
 * @access  Public
 */
router.get('/company/:slug/info', jobController_1.getCompanyInfoBySlug);
/**
 * @route   GET /api/v1/jobs/company/:slug
 * @desc    Get jobs by company slug
 * @access  Public
 */
router.get('/company/:slug', auth_1.optionalAuth, jobController_1.getJobsByCompanySlug);
/**
 * @route   GET /api/v1/jobs/:id
 * @desc    Get job by ID
 * @access  Public (optionalAuth - checks company authorization for HR/employer)
 */
router.get('/:id', auth_1.optionalAuth, [(0, express_validator_1.param)('id').isMongoId().withMessage('Invalid job ID')], validator_1.validate, jobController_1.getJobById);
/**
 * @route   POST /api/v1/jobs
 * @desc    Create new job
 * @access  Private (Employer, HR, Admin)
 */
router.post('/', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.body)('title').trim().notEmpty().withMessage('Job title is required'),
    (0, express_validator_1.body)('description').trim().notEmpty().withMessage('Job description is required'),
    (0, express_validator_1.body)('companyId').optional().isMongoId().withMessage('Invalid company ID'),
    (0, express_validator_1.body)('location').optional().trim(),
    (0, express_validator_1.body)('jobType').optional().isIn(['full_time', 'part_time', 'contract', 'internship', 'temporary']),
    (0, express_validator_1.body)('workMode').optional().isIn(['onsite', 'remote', 'hybrid']),
    (0, express_validator_1.body)('experienceMin').optional().isInt({ min: 0 }).withMessage('Minimum experience must be a positive number'),
    (0, express_validator_1.body)('experienceMax').optional().isInt({ min: 0 }).withMessage('Maximum experience must be a positive number'),
    (0, express_validator_1.body)('salaryMin').optional().isInt({ min: 0 }).withMessage('Minimum salary must be a positive number'),
    (0, express_validator_1.body)('salaryMax').optional().isInt({ min: 0 }).withMessage('Maximum salary must be a positive number'),
    (0, express_validator_1.body)('skills').optional().isArray().withMessage('Skills must be an array'),
    (0, express_validator_1.body)('currency').optional().trim(),
], validator_1.validate, jobController_1.createJob);
/**
 * @route   PUT /api/v1/jobs/:id
 * @desc    Update job
 * @access  Private (Employer, HR, Admin)
 */
router.put('/:id', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [
    (0, express_validator_1.param)('id').isMongoId().withMessage('Invalid job ID'),
    (0, express_validator_1.body)('title').optional().trim().notEmpty().withMessage('Job title cannot be empty'),
    (0, express_validator_1.body)('description').optional().trim().notEmpty().withMessage('Job description cannot be empty'),
    (0, express_validator_1.body)('companyId').optional().isMongoId().withMessage('Invalid company ID'),
], validator_1.validate, jobController_1.updateJob);
/**
 * @route   DELETE /api/v1/jobs/:id
 * @desc    Delete job (soft delete)
 * @access  Private (Employer, HR, Admin)
 */
router.delete('/:id', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), [(0, express_validator_1.param)('id').isMongoId().withMessage('Invalid job ID')], validator_1.validate, jobController_1.deleteJob);
exports.default = router;
//# sourceMappingURL=jobs.js.map