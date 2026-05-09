/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import express from 'express';
import {
  getIntegrations,
  initiateOAuth,
  oauthCallback,
  disconnectIntegration,
  searchCandidates,
  searchCandidatesForJob,
  saveSourcedCandidate,
  getSourcedCandidates,
  updateCandidateStatus,
  getSourcingStats,
  exportCandidates,
} from '../controllers/sourcingController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

// OAuth callback routes — must be before protect middleware (redirects from external providers)
router.get('/oauth/:platform/callback', oauthCallback);

// All other routes require auth + employer/hr/admin role
router.use(protect);
router.use(authorize(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.HR));

// Integration management
router.get('/integrations', getIntegrations);
router.post('/oauth/:platform/connect', initiateOAuth);
router.delete('/integrations/:platform', disconnectIntegration);

// Candidate search
router.post('/search', searchCandidates);
router.post('/jobs/:jobId/candidates', searchCandidatesForJob);

// Sourced candidate management
router.post('/candidates', saveSourcedCandidate);
router.get('/candidates', getSourcedCandidates);
router.get('/candidates/export', exportCandidates);
router.put('/candidates/:id/status', updateCandidateStatus);

// Stats
router.get('/stats', getSourcingStats);

export default router;
