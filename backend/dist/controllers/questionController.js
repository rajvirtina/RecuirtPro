"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionStats = exports.autoGenerateQuestions = exports.deleteQuestion = exports.updateQuestion = exports.getQuestionById = exports.getQuestions = exports.createQuestion = void 0;
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Create a new question
 * @route   POST /api/v1/questions
 * @access  Private (Employer/HR/Admin)
 */
const createQuestion = async (req, res) => {
    try {
        const { question, questionType, difficulty, skills, expectedAnswer, hints, estimatedDuration, } = req.body;
        const newQuestion = await models_1.Question.create({
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
        logger_1.default.info(`Question created: ${newQuestion._id}`);
        return (0, response_1.sendSuccess)(res, newQuestion, 'Question created successfully', 201);
    }
    catch (error) {
        logger_1.default.error('Error in createQuestion:', error);
        return (0, response_1.sendError)(res, error.message || 'Error creating question', 500);
    }
};
exports.createQuestion = createQuestion;
/**
 * @desc    Get all questions with filters
 * @route   GET /api/v1/questions
 * @access  Private
 */
const getQuestions = async (req, res) => {
    try {
        const { page = 1, limit = 20, difficulty, questionType, skills, search, } = req.query;
        const query = { isActive: true };
        // TENANT ISOLATION: Scope questions to company (super admin sees all)
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            query.$and = [
                { $or: [{ companyId: tenantId }, { companyId: null }] },
            ];
        }
        // Apply filters
        if (difficulty)
            query.difficulty = difficulty;
        if (questionType)
            query.questionType = questionType;
        if (skills) {
            const skillsArray = skills.split(',');
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
            }
            else {
                query.$or = searchFilter;
            }
        }
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const [questions, total] = await Promise.all([
            models_1.Question.find(query)
                .select('-expectedAnswer') // Don't send expected answer by default
                .populate('createdBy', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            models_1.Question.countDocuments(query),
        ]);
        return (0, response_1.sendPaginatedResponse)(res, questions, pageNum, limitNum, total, 'Questions retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getQuestions:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching questions', 500);
    }
};
exports.getQuestions = getQuestions;
/**
 * @desc    Get single question by ID
 * @route   GET /api/v1/questions/:id
 * @access  Private
 */
const getQuestionById = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await models_1.Question.findById(id).populate('createdBy', 'firstName lastName');
        if (!question) {
            return (0, response_1.sendError)(res, 'Question not found', 404);
        }
        // Check authorization
        const isAuthorized = req.user?.role === 'admin' ||
            question.companyId?.toString() === req.user?.companyId ||
            !question.companyId; // Global question
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to view this question', 403);
        }
        return (0, response_1.sendSuccess)(res, question, 'Question retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getQuestionById:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching question', 500);
    }
};
exports.getQuestionById = getQuestionById;
/**
 * @desc    Update question
 * @route   PUT /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const question = await models_1.Question.findById(id);
        if (!question) {
            return (0, response_1.sendError)(res, 'Question not found', 404);
        }
        // Check authorization
        const isAuthorized = req.user?.role === 'admin' ||
            question.createdBy.toString() === req.user?._id;
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to update this question', 403);
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
                question[key] = updates[key];
            }
        });
        await question.save();
        logger_1.default.info(`Question ${id} updated`);
        return (0, response_1.sendSuccess)(res, question, 'Question updated successfully');
    }
    catch (error) {
        logger_1.default.error('Error in updateQuestion:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating question', 500);
    }
};
exports.updateQuestion = updateQuestion;
/**
 * @desc    Delete question (soft delete)
 * @route   DELETE /api/v1/questions/:id
 * @access  Private (Creator/Admin)
 */
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await models_1.Question.findById(id);
        if (!question) {
            return (0, response_1.sendError)(res, 'Question not found', 404);
        }
        // Check authorization — must be creator or company admin of same company
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            question.createdBy.toString() === req.user?._id ||
            (tenantId && question.companyId?.toString() === tenantId);
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized to delete this question', 403);
        }
        // Soft delete via isActive flag (GAP-05 — comment said soft delete but was hard delete)
        question.isActive = false;
        await question.save();
        logger_1.default.info(`Question ${id} soft-deleted (isActive=false)`);
        return (0, response_1.sendSuccess)(res, null, 'Question deleted successfully');
    }
    catch (error) {
        logger_1.default.error('Error in deleteQuestion:', error);
        return (0, response_1.sendError)(res, error.message || 'Error deleting question', 500);
    }
};
exports.deleteQuestion = deleteQuestion;
/**
 * @desc    Auto-generate questions for interview based on job requirements
 * @route   POST /api/v1/questions/auto-generate
 * @access  Private (Employer/HR/Admin)
 */
const autoGenerateQuestions = async (req, res) => {
    try {
        const { skills, difficulty, count = 10 } = req.body;
        const query = {
            isActive: true,
            skills: { $in: skills },
        };
        // TENANT ISOLATION: Only return company's own questions + global
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            query.$or = [{ companyId: tenantId }, { companyId: null }];
        }
        if (difficulty) {
            query.difficulty = difficulty;
        }
        // Get random questions
        const questions = await models_1.Question.aggregate([
            { $match: query },
            { $sample: { size: parseInt(count, 10) } },
        ]);
        return (0, response_1.sendSuccess)(res, questions, `${questions.length} questions auto-generated`);
    }
    catch (error) {
        logger_1.default.error('Error in autoGenerateQuestions:', error);
        return (0, response_1.sendError)(res, error.message || 'Error auto-generating questions', 500);
    }
};
exports.autoGenerateQuestions = autoGenerateQuestions;
/**
 * @desc    Get question statistics
 * @route   GET /api/v1/questions/stats
 * @access  Private
 */
const getQuestionStats = async (req, res) => {
    try {
        const query = { isActive: true };
        // TENANT ISOLATION: Scope question stats to company
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId) {
            query.$or = [
                { companyId: tenantId },
                { companyId: null },
            ];
        }
        const stats = await models_1.Question.aggregate([
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
        const difficultyCount = await models_1.Question.aggregate([
            { $match: query },
            { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        ]);
        // Count by type
        const typeCount = await models_1.Question.aggregate([
            { $match: query },
            { $group: { _id: '$questionType', count: { $sum: 1 } } },
        ]);
        return (0, response_1.sendSuccess)(res, {
            total: stats[0]?.total || 0,
            byDifficulty: difficultyCount,
            byType: typeCount,
            avgDuration: Math.round(stats[0]?.avgDuration || 0),
        }, 'Statistics retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getQuestionStats:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching statistics', 500);
    }
};
exports.getQuestionStats = getQuestionStats;
//# sourceMappingURL=questionController.js.map