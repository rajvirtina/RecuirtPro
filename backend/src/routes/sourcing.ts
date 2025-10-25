/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import express from 'express';
import {
  searchCandidates,
  searchCandidatesForJob,
  getSourcingStats,
} from '../controllers/sourcingController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

// All routes require authentication and employer/hr/admin role
router.use(protect);
router.use(authorize(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.HR));

// Search candidates from multiple sources
router.post('/search', searchCandidates);

// Search candidates for a specific job
router.post('/jobs/:jobId/candidates', searchCandidatesForJob);

// Get sourcing statistics
router.get('/stats', getSourcingStats);

export default router;
