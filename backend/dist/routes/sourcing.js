"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sourcingController_1 = require("../controllers/sourcingController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
// OAuth callback routes — must be before protect middleware (redirects from external providers)
router.get('/oauth/:platform/callback', sourcingController_1.oauthCallback);
// All other routes require auth + employer/hr/admin role
router.use(auth_1.protect);
router.use((0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.EMPLOYER, types_1.UserRole.HR));
// Integration management
router.get('/integrations', sourcingController_1.getIntegrations);
router.post('/oauth/:platform/connect', sourcingController_1.initiateOAuth);
router.delete('/integrations/:platform', sourcingController_1.disconnectIntegration);
// Candidate search
router.post('/search', sourcingController_1.searchCandidates);
router.post('/jobs/:jobId/candidates', sourcingController_1.searchCandidatesForJob);
// Sourced candidate management
router.post('/candidates', sourcingController_1.saveSourcedCandidate);
router.get('/candidates', sourcingController_1.getSourcedCandidates);
router.get('/candidates/export', sourcingController_1.exportCandidates);
router.put('/candidates/:id/status', sourcingController_1.updateCandidateStatus);
// Stats
router.get('/stats', sourcingController_1.getSourcingStats);
exports.default = router;
//# sourceMappingURL=sourcing.js.map