"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.protect);
// Employer/HR/Admin dashboard
router.get('/employer', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER, types_1.UserRole.HR), dashboardController_1.getEmployerDashboard);
// Candidate dashboard
router.get('/candidate', (0, auth_1.authorize)(types_1.UserRole.CANDIDATE), dashboardController_1.getCandidateDashboard);
// Recruitment analytics
router.get('/analytics', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER, types_1.UserRole.HR), dashboardController_1.getRecruitmentAnalytics);
// Export reports
router.get('/export', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER, types_1.UserRole.HR), dashboardController_1.exportReport);
exports.default = router;
//# sourceMappingURL=dashboard.js.map