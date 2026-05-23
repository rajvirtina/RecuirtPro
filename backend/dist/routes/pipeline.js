"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const pipelineController_1 = require("../controllers/pipelineController");
const types_1 = require("../types");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/v1/pipeline
 * @desc    Get applications grouped by stage, optionally filtered by jobId
 * @access  Private (HR, Employer, Admin, Interviewer)
 */
router.get('/', auth_1.protect, (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN, types_1.UserRole.INTERVIEWER), [
    (0, express_validator_1.query)('jobId').optional().isMongoId().withMessage('Invalid job ID'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 500 }),
], validator_1.validate, pipelineController_1.getPipeline);
exports.default = router;
//# sourceMappingURL=pipeline.js.map