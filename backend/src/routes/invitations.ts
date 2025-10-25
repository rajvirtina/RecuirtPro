import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { body } from 'express-validator';
import { UserRole } from '../types';
import {
  sendCandidateInvitation,
  verifyInvitationToken,
  getInvitations,
  resendInvitation,
} from '../controllers/invitationController';

const router = express.Router();

// Public routes
router.get('/verify/:token', verifyInvitationToken);

// Protected routes
router.use(protect);

// HR/Employer/Admin only routes
router.post(
  '/send',
  authorize(UserRole.HR, UserRole.EMPLOYER, UserRole.ADMIN),
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  sendCandidateInvitation
);

router.get(
  '/',
  authorize(UserRole.HR, UserRole.EMPLOYER, UserRole.ADMIN),
  getInvitations
);

router.post(
  '/:id/resend',
  authorize(UserRole.HR, UserRole.EMPLOYER, UserRole.ADMIN),
  resendInvitation
);

export default router;
