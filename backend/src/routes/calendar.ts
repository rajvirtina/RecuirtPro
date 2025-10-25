import express from 'express';
import {
  initiateOAuth,
  handleOAuthCallback,
  getIntegrations,
  deleteIntegration,
  createCalendarEvent,
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

export default router;
