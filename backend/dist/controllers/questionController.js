"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionStats = exports.batchCreateQuestions = exports.generateFromJob = exports.autoGenerateQuestions = exports.deleteQuestion = exports.updateQuestion = exports.getQuestionById = exports.getQuestions = exports.createQuestion = void 0;
const axios_1 = __importDefault(require("axios"));
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
// Lightweight axios instance for LLM calls within this controller
const llmHttp = axios_1.default.create({
    baseURL: config_1.default.llm?.serviceUrl || 'http://localhost:8001',
    timeout: 45000,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config_1.default.llm?.apiSecretKey || '',
    },
});
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
 * @desc    Generate questions from a job description via LLM (preview only — not saved)
 *          HR reviews the results and POSTs selected questions to POST /questions to save them.
 * @route   POST /api/v1/questions/generate
 * @access  Private (Employer/HR/Admin)
 */
const generateFromJob = async (req, res) => {
    try {
        const { jobId, count = 10 } = req.body;
        if (!jobId) {
            return (0, response_1.sendError)(res, 'jobId is required', 400);
        }
        const countNum = Math.min(Math.max(parseInt(String(count), 10) || 10, 5), 20);
        const job = await models_1.Job.findById(jobId).lean();
        if (!job) {
            return (0, response_1.sendError)(res, 'Job not found', 404);
        }
        // Tenant isolation
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && job.companyId?.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorised to generate questions for this job', 403);
        }
        // Call LLM service
        let generated = [];
        let llmAvailable = false;
        try {
            const llmRes = await llmHttp.post('/api/generate-questions', {
                job_title: job.title,
                job_description: job.description || job.title,
                required_skills: job.skills || [],
                interview_round: 'L1',
                difficulty: 'senior',
                num_questions: countNum,
            });
            generated = llmRes.data?.questions || [];
            llmAvailable = generated.length > 0;
        }
        catch (llmErr) {
            logger_1.default.warn(`LLM generate-from-job failed: ${llmErr.message}`);
        }
        // Normalise into preview shape (not yet saved — no _id, no companyId)
        const preview = generated
            .map((q, i) => ({
            _tempId: i,
            question: q.text || q.question || '',
            questionType: q.type || 'technical',
            difficulty: 'senior',
            skills: Array.isArray(q.skills) ? q.skills : (job.skills || []).slice(0, 3),
            expectedAnswer: q.expected_answer || '',
            estimatedDuration: 5,
        }))
            .filter((q) => q.question.trim().length > 0);
        logger_1.default.info(`generateFromJob: ${preview.length} questions generated for job ${jobId}`);
        return (0, response_1.sendSuccess)(res, {
            jobTitle: job.title,
            jobSkills: job.skills || [],
            questions: preview,
            generatedCount: preview.length,
            llmAvailable,
        }, `${preview.length} questions generated`);
    }
    catch (error) {
        logger_1.default.error('Error in generateFromJob:', error);
        return (0, response_1.sendError)(res, error.message || 'Error generating questions', 500);
    }
};
exports.generateFromJob = generateFromJob;
/**
 * @desc    Batch-save accepted questions to the question bank
 *          Called by the frontend after HR reviews and accepts generated questions.
 * @route   POST /api/v1/questions/batch
 * @access  Private (Employer/HR/Admin)
 */
const batchCreateQuestions = async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return (0, response_1.sendError)(res, 'questions array is required', 400);
        }
        const companyId = req.user?.companyId;
        const createdById = req.user?._id;
        const docs = questions.map((q) => ({
            companyId,
            question: q.question || q.text,
            questionType: q.questionType || q.type || 'technical',
            difficulty: q.difficulty || 'senior',
            skills: Array.isArray(q.skills) ? q.skills : [],
            expectedAnswer: q.expectedAnswer || '',
            estimatedDuration: q.estimatedDuration || 5,
            isActive: true,
            createdBy: createdById,
            usageCount: 0,
        }));
        const saved = await models_1.Question.insertMany(docs, { ordered: false });
        logger_1.default.info(`batchCreateQuestions: ${saved.length} questions saved for company ${companyId}`);
        return (0, response_1.sendSuccess)(res, { savedCount: saved.length }, `${saved.length} questions saved to bank`, 201);
    }
    catch (error) {
        logger_1.default.error('Error in batchCreateQuestions:', error);
        return (0, response_1.sendError)(res, error.message || 'Error saving questions', 500);
    }
};
exports.batchCreateQuestions = batchCreateQuestions;
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