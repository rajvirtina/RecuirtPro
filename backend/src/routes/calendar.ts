import express from 'express';
import {
  initiateOAuth,
  handleOAuthCallback,
  getIntegrations,
  deleteIntegration,
  createCalendarEvent,
  getFreeBusy,
} from '../controllers/calendarController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

/**
 * OAuth routes
 */
router.get('/auth/:provider', protect, initiateOAuth);
router.get('/callback/:provider', handleOAuthCallback);

/**
 * Integration management routes
 */
router.use(protect);

router.get('/integrations', getIntegrations);
router.delete('/integrations/:id', deleteIntegration);

/**
 * Calendar event routes
 */
router.post(
  '/event/:interviewId',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  createCalendarEvent
);

/**
 * Check panel availability using connected calendar free/busy data
 */
router.post(
  '/check-availability',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  getFreeBusy
);

export default router;
