import { Response } from 'express';
import { Question, InterviewTemplate } from '../models';
import { AuthRequest, QuestionDifficulty } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse } from '../utils/response';
import logger from '../utils/logger';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';

/**
 * @desc    Create a new question
 * @route   POST /api/v1/questions
 * @access  Private (Employer/HR/Admin)
 */
export const createQuestion = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      question,
      questionType,
      difficulty,
      skills,
      expectedAnswer,
      hints,
      estimatedDuration,
    } = req.body;

    const newQuestion = await Question.create({
      companyId: req.user?.companyId,
      question,
      questionType,
      difficulty,
      skills,
      expectedAnswer,
      hints,
      estimatedDuration: estimatedDuration || 5,
      createdBy: req.user?._id,
      isActive: true,
    });

    logger.info(`Question created: ${newQuestion._id}`);

    return sendSuccess(res, newQuestion, 'Question created successfully', 201);
  } catch (error: any) {
    logger.error('Error in createQuestion:', error);
    return sendError(res, error.message || 'Error creating question', 500);
  }
};

/**
 * @desc    Get all questions with filters
 * @route   GET /api/v1/questions
 * @access  Private
 */
export const getQuestions = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      page = 1,
      limit = 20,
      difficulty,
      questionType,
      skills,
      search,
    } = req.query;

    const query: any = { isActive: true };

    // TENANT ISOLATION: Scope questions to company (super admin sees all)
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      query.$and = [
        { $or: [{ companyId: tenantId }, { companyId: null }] },
      ];
    }

    // Apply filters
    if (difficulty) query.difficulty = difficulty;
    if (questionType) query.questionType = questionType;
    if (skills) {
      const skillsArray = (skills as string).split(',');
      query.skills = { $in: skillsArray };
    }
    if (search) {
      const searchFilter = [
        { question: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ];
      // Combine search with existing $and to avoid overwriting company filter
      if (query.$and) {
        query.$and.push({ $or: searchFilter });
      } else {
        query.$or = searchFilter;
      }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      Question.find(query)
        .select('-expectedAnswer') // Don't send expected answer by default
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Question.countDocuments(query),
    ]);

    return sendPaginatedResponse(
      res,
      questions,
      pageNum,
      limitNum,
      total,
      'Questions retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getQuestions:', error);
    return sendError(res, error.message || 'Error fetching questions', 500);
  }
};

/**
 * @desc    Get single question by ID
 * @route   GET /api/v1/questions/:id
 * @access  Private
 */
export const getQuestionById = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id).populate('createdBy', 'firstName lastName');

    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    // Check authorization
    const isAuthorized =
      req.user?.role === 'admin' ||
      question.companyId?.toString() === req.user?.companyId ||
      !question.companyId; // Global question

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to view this question', 403);
    }

    return sendSuccess(res, question, 'Question retrieved successfully');
  } catch (error: any) {
    logger.error('Error in getQuestionById:', error);
    return sendError(res, error.message || 'Error fetching question', 500);
  }
};

/**
 * @desc    Update question
 * @route   PUT /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
export const updateQuestion = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const question = await Question.findById(id);

    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    // Check authorization
    const isAuthorized =
      req.user?.role === 'admin' ||
      question.createdBy.toString() === req.user?._id;

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to update this question', 403);
    }

    // Update fields
    const allowedUpdates = [
      'question',
      'questionType',
      'difficulty',
      'skills',
      'expectedAnswer',
      'hints',
      'estimatedDuration',
      'isActive',
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        (question as any)[key] = updates[key];
      }
    });

    await question.save();

    logger.info(`Question ${id} updated`);

    return sendSuccess(res, question, 'Question updated successfully');
  } catch (error: any) {
    logger.error('Error in updateQuestion:', error);
    return sendError(res, error.message || 'Error updating question', 500);
  }
};

/**
 * @desc    Delete question (soft delete)
 * @route   DELETE /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
export const deleteQuestion = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);

    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    // Check authorization — must be creator or company admin of same company
    const tenantId = getTenantCompanyId(req.user);
    const isAuthorized =
      isSuperAdmin(req.user) ||
      question.createdBy.toString() === req.user?._id ||
      (tenantId && question.companyId?.toString() === tenantId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to delete this question', 403);
    }

    // Soft delete via isActive flag (GAP-05 — comment said soft delete but was hard delete)
    question.isActive = false;
    await question.save();

    logger.info(`Question ${id} soft-deleted (isActive=false)`);

    return sendSuccess(res, null, 'Question deleted successfully');
  } catch (error: any) {
    logger.error('Error in deleteQuestion:', error);
    return sendError(res, error.message || 'Error deleting question', 500);
  }
};

/**
 * @desc    Auto-generate questions for interview based on job requirements
 * @route   POST /api/v1/questions/auto-generate
 * @access  Private (Employer/HR/Admin)
 */
export const autoGenerateQuestions = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { skills, difficulty, count = 10 } = req.body;

    const query: any = {
      isActive: true,
      skills: { $in: skills },
    };

    // TENANT ISOLATION: Only return company's own questions + global
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      query.$or = [{ companyId: tenantId }, { companyId: null }];
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Get random questions
    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: parseInt(count as string, 10) } },
    ]);

    return sendSuccess(
      res,
      questions,
      `${questions.length} questions auto-generated`
    );
  } catch (error: any) {
    logger.error('Error in autoGenerateQuestions:', error);
    return sendError(res, error.message || 'Error auto-generating questions', 500);
  }
};

/**
 * @desc    Get question statistics
 * @route   GET /api/v1/questions/stats
 * @access  Private
 */
export const getQuestionStats = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const query: any = { isActive: true };

    // TENANT ISOLATION: Scope question stats to company
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId) {
      query.$or = [
        { companyId: tenantId },
        { companyId: null },
      ];
    }

    const stats = await Question.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byDifficulty: {
            $push: {
              difficulty: '$difficulty',
              count: 1,
            },
          },
          byType: {
            $push: {
              type: '$questionType',
              count: 1,
            },
          },
          avgDuration: { $avg: '$estimatedDuration' },
        },
      },
    ]);

    // Count by difficulty
    const difficultyCount = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);

    // Count by type
    const typeCount = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$questionType', count: { $sum: 1 } } },
    ]);

    return sendSuccess(
      res,
      {
        total: stats[0]?.total || 0,
        byDifficulty: difficultyCount,
        byType: typeCount,
        avgDuration: Math.round(stats[0]?.avgDuration || 0),
      },
      'Statistics retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getQuestionStats:', error);
    return sendError(res, error.message || 'Error fetching statistics', 500);
  }
};
