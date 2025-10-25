/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import express from 'express';
import {
  getEmployerDashboard,
  getCandidateDashboard,
  getRecruitmentAnalytics,
  exportReport,
} from '../controllers/dashboardController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employer/HR/Admin dashboard
router.get('/employer', authorize(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.HR), getEmployerDashboard);

// Candidate dashboard
router.get('/candidate', authorize(UserRole.CANDIDATE), getCandidateDashboard);

// Recruitment analytics
router.get('/analytics', authorize(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.HR), getRecruitmentAnalytics);

// Export reports
router.get('/export', authorize(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.HR), exportReport);

export default router;
