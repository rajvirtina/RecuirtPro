import { Router } from 'express';
import * as scheduleController from '../controllers/scheduleController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

/**
 * Public: Candidate views available slots
 */
router.get('/:token', scheduleController.getScheduleByToken);

/**
 * Public: Candidate books a slot
 */
router.post('/:token/book', scheduleController.bookSlot);

/**
 * Protected: Generate self-schedule link for an interview
 */
router.post(
  '/generate/:interviewId',
  protect,
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  scheduleController.generateSelfScheduleLink
);

export default router;
