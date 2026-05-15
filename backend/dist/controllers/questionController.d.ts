import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Create a new question
 * @route   POST /api/v1/questions
 * @access  Private (Employer/HR/Admin)
 */
export declare const createQuestion: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get all questions with filters
 * @route   GET /api/v1/questions
 * @access  Private
 */
export declare const getQuestions: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get single question by ID
 * @route   GET /api/v1/questions/:id
 * @access  Private
 */
export declare const getQuestionById: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update question
 * @route   PUT /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
export declare const updateQuestion: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Delete question (soft delete)
 * @route   DELETE /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
export declare const deleteQuestion: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Auto-generate questions for interview based on job requirements
 * @route   POST /api/v1/questions/auto-generate
 * @access  Private (Employer/HR/Admin)
 */
export declare const autoGenerateQuestions: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get question statistics
 * @route   GET /api/v1/questions/stats
 * @access  Private
 */
export declare const getQuestionStats: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=questionController.d.ts.map