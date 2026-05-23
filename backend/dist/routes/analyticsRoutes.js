"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const analyticsController_1 = require("../controllers/analyticsController");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const hrAdminEmployer = [types_1.UserRole.HR, types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER];
const dateQueryValidators = [
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
];
/** Conversion funnel: Applied → Shortlisted → Interviewed → Offer Sent → Hired */
router.get('/funnel', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), dateQueryValidators, validator_1.validate, analyticsController_1.getFunnel);
/** Daily application volume with AI-qualified line */
router.get('/applications-over-time', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), [
    (0, express_validator_1.query)('period').optional().matches(/^\d+d$/).withMessage("period must be in format '30d'"),
    ...dateQueryValidators,
], validator_1.validate, analyticsController_1.getApplicationsOverTime);
/** Application source breakdown (direct, naukri, linkedin …) */
router.get('/source-breakdown', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), dateQueryValidators, validator_1.validate, analyticsController_1.getSourceBreakdown);
/** Average days-to-hire grouped by department */
router.get('/time-to-hire', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), [
    (0, express_validator_1.query)('groupBy').optional().isIn(['department', 'role']),
    ...dateQueryValidators,
], validator_1.validate, analyticsController_1.getTimeToHire);
/** Per-recruiter activity: applications, interviews, offers, response time */
router.get('/recruiter-productivity', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), dateQueryValidators, validator_1.validate, analyticsController_1.getRecruiterProductivity);
/** Offer acceptance rate breakdown */
router.get('/offer-rate', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), dateQueryValidators, validator_1.validate, analyticsController_1.getOfferRate);
/** AI interview score distribution histogram */
router.get('/ai-score-distribution', auth_1.protect, (0, auth_1.authorize)(...hrAdminEmployer), dateQueryValidators, validator_1.validate, analyticsController_1.getAIScoreDistribution);
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map