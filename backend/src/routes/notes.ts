import { Router } from 'express';
import * as noteController from '../controllers/noteController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Notes
router.get(
  '/applications/:id/notes',
  authorize('employer', 'hr', 'admin', 'super_admin'),
  noteController.getNotes
);

router.post(
  '/applications/:id/notes',
  authorize('employer', 'hr', 'admin', 'super_admin'),
  noteController.createNote
);

router.delete(
  '/applications/:id/notes/:noteId',
  authorize('employer', 'hr', 'admin', 'super_admin'),
  noteController.deleteNote
);

// Timeline
router.get(
  '/applications/:id/timeline',
  authorize('employer', 'hr', 'admin', 'super_admin'),
  noteController.getTimeline
);

export default router;
