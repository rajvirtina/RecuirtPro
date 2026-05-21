"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const resumeParserController_1 = require("../controllers/resumeParserController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const hrAdminEmployer = [types_1.UserRole.HR, types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER];
/**
 * @route  POST /api/v1/applications/:id/parse-resume
 * @desc   Extract skills, experience, education from the uploaded resume via LLM
 * @access HR / Admin / Employer
 */
router.post('/applications/:id/parse-resume', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), [(0, express_validator_1.param)('id').isMongoId().withMessage('Valid application ID is required')], validator_1.validate, resumeParserController_1.parseResume);
/**
 * @route  POST /api/v1/jobs/:jobId/parse-all-resumes
 * @desc   Bulk-parse all unparsed resumes for a job
 * @access HR / Admin / Employer
 */
router.post('/jobs/:jobId/parse-all-resumes', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), [(0, express_validator_1.param)('jobId').isMongoId().withMessage('Valid job ID is required')], validator_1.validate, resumeParserController_1.parseAllResumes);
/**
 * @route  POST /api/v1/jobs/:jobId/rank-candidates
 * @desc   Score and rank all parsed applications for a job
 * @access HR / Admin / Employer
 */
router.post('/jobs/:jobId/rank-candidates', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), [(0, express_validator_1.param)('jobId').isMongoId().withMessage('Valid job ID is required')], validator_1.validate, resumeParserController_1.rankCandidates);
exports.default = router;
//# sourceMappingURL=resumeParserRoutes.js.map