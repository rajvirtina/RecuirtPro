import { Router } from 'express';
import * as noteController from '../controllers/noteController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// All routes require authentication
router.use(protect);

// Notes
router.get(
  '/applications/:id/notes',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  noteController.getNotes
);

router.post(
  '/applications/:id/notes',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  noteController.createNote
);

router.delete(
  '/applications/:id/notes/:noteId',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  noteController.deleteNote
);

// Timeline
router.get(
  '/applications/:id/timeline',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  noteController.getTimeline
);

export default router;
