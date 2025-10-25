import express from 'express';
import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  autoGenerateQuestions,
  getQuestionStats,
} from '../controllers/questionController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * Question CRUD routes
 */
router.post(
  '/',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  createQuestion
);
router.get('/', getQuestions);
router.get('/stats', getQuestionStats);
router.get('/:id', getQuestionById);
router.put(
  '/:id',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  updateQuestion
);
router.delete(
  '/:id',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  deleteQuestion
);

/**
 * Auto-generate questions
 */
router.post(
  '/auto-generate',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  autoGenerateQuestions
);

export default router;
