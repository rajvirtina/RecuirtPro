"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const jobTemplateController_1 = require("../controllers/jobTemplateController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.use((0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN));
// ─── Job Templates ───────────────────────────────────────────────────────────
router.get('/', jobTemplateController_1.getJobTemplates);
router.post('/', [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Template name is required'),
    (0, express_validator_1.body)('title').trim().notEmpty().withMessage('Job title is required'),
], validator_1.validate, jobTemplateController_1.createJobTemplate);
router.post('/from-job/:jobId', [
    (0, express_validator_1.param)('jobId').isMongoId().withMessage('Invalid job ID'),
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Template name is required'),
], validator_1.validate, jobTemplateController_1.createTemplateFromJob);
router.delete('/:id', [(0, express_validator_1.param)('id').isMongoId().withMessage('Invalid template ID')], validator_1.validate, jobTemplateController_1.deleteJobTemplate);
exports.default = router;
//# sourceMappingURL=jobTemplates.js.map