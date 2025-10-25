import express from 'express';
import {
  verifySystemReadiness,
  logProctoringEvent,
  getProctoringEvents,
  reviewProctoringEvent,
  getSystemCheckStatus,
  reportDesktopEvent,
  sendHeartbeat,
  getInterviewStatus,
  getRecentProctoringEvents,
} from '../controllers/proctoringController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

/**
 * Public routes (accessible with interview link)
 */
router.post('/verify/:interviewId', verifySystemReadiness);
router.post('/event', logProctoringEvent);
router.get('/system-check/:interviewId', getSystemCheckStatus);

/**
 * Protected routes (require authentication)
 */
router.use(protect);

// Desktop app routes
router.post('/desktop-event', reportDesktopEvent);
router.post('/heartbeat', sendHeartbeat);
router.get('/interview-status/:interviewId', getInterviewStatus);

// HR/Admin routes
router.get(
  '/events/recent',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  getRecentProctoringEvents
);
router.get(
  '/events/:interviewId',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  getProctoringEvents
);
router.put(
  '/event/:id/review',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  reviewProctoringEvent
);

export default router;