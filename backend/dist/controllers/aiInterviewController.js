"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionForReview = exports.completeSession = exports.submitAnswer = exports.startSession = exports.getSession = exports.createSession = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const AIInterviewSession_1 = require("../models/AIInterviewSession");
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
// ─── LLM service axios client (no JWT, uses X-API-Key) ───────────────────────
const llm = axios_1.default.create({
    baseURL: config_1.default.llm.serviceUrl,
    timeout: 45000,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config_1.default.llm.apiSecretKey,
    },
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateSessionId() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
/** Resolve and validate a public session token. Returns null when invalid/expired. */
async function resolveSession(sessionId) {
    const session = await AIInterviewSession_1.AIInterviewSession.findOne({ sessionId }).lean();
    if (!session)
        return null;
    if (session.status === 'expired')
        return null;
    // Auto-expire if past expiresAt
    if (new Date() > session.expiresAt) {
        await AIInterviewSession_1.AIInterviewSession.updateOne({ sessionId }, { status: 'expired' });
        return null;
    }
    return session;
}
/** Derive recommendation label from pass-rate and mean score. */
function deriveRecommendation(passRate, meanOverall) {
    if (meanOverall >= 8 && passRate >= 0.8)
        return 'strong_hire';
    if (meanOverall >= 6 && passRate >= 0.6)
        return 'hire';
    if (meanOverall >= 4 && passRate >= 0.4)
        return 'hold';
    return 'reject';
}
/** Build a final analysis object from stored responses. */
function buildAnalysis(responses, totalQuestions) {
    if (responses.length === 0) {
        return {
            overallScore: 0, technicalScore: 0, communicationScore: 0, confidenceScore: 0,
            questionsAnswered: 0, questionsPassed: 0,
            recommendation: 'hold',
            strengths: [], improvements: [],
            summary: 'Interview completed with no recorded responses.',
            generatedAt: new Date(),
        };
    }
    const n = responses.length;
    const avg = (key) => Math.round(responses.reduce((s, r) => s + r.scores[key], 0) / n);
    const techAvg = avg('technicalAccuracy');
    const commAvg = avg('communicationClarity');
    const confAvg = avg('confidence');
    const overAvg = avg('overall');
    const passCount = responses.filter(r => r.passed).length;
    const passRate = passCount / n;
    const normalise = (v) => Math.round((v / 10) * 100);
    return {
        overallScore: normalise(overAvg),
        technicalScore: normalise(techAvg),
        communicationScore: normalise(commAvg),
        confidenceScore: normalise(confAvg),
        questionsAnswered: n,
        questionsPassed: passCount,
        recommendation: deriveRecommendation(passRate, overAvg),
        strengths: responses.filter(r => r.passed).slice(0, 3).map(r => r.feedback).filter(Boolean),
        improvements: responses.filter(r => !r.passed).slice(0, 3).map(r => r.improvementTip).filter(Boolean),
        summary: `Completed ${n}/${totalQuestions} questions. Pass rate: ${Math.round(passRate * 100)}%. Average overall score: ${overAvg}/10.`,
        generatedAt: new Date(),
    };
}
// ─── Controller functions ─────────────────────────────────────────────────────
/**
 * @desc  Create an AI Interview Session for a scheduled interview (HR/Admin)
 * @route POST /api/v1/ai-interviews
 * @auth  JWT required (HR / Admin / Employer)
 */
const createSession = async (req, res) => {
    try {
        const { interviewId, difficulty = 'senior', numQuestions = 7 } = req.body;
        if (!interviewId) {
            (0, response_1.sendError)(res, 'interviewId is required', 400);
            return;
        }
        // Load interview with populated refs
        const interview = await models_1.Interview.findById(interviewId)
            .populate('jobId', 'title description skills companyId')
            .populate('companyId', 'name')
            .populate('candidateId', 'firstName lastName email');
        if (!interview) {
            (0, response_1.sendError)(res, 'Interview not found', 404);
            return;
        }
        // Tenant isolation
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && interview.companyId?.toString() !== tenantId) {
            (0, response_1.sendError)(res, 'Not authorised to create AI session for this interview', 403);
            return;
        }
        // Prevent duplicate sessions
        const existing = await AIInterviewSession_1.AIInterviewSession.findOne({ interviewId: interview._id, status: { $ne: 'expired' } });
        if (existing) {
            const url = `${config_1.default.frontendUrl}/ai-interview/${existing.sessionId}`;
            (0, response_1.sendSuccess)(res, { sessionId: existing.sessionId, sessionUrl: url, alreadyExists: true }, 'Session already exists');
            return;
        }
        const job = interview.jobId;
        const comp = interview.companyId;
        const sessionId = generateSessionId();
        // Session valid for 72 h from creation
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        const session = await AIInterviewSession_1.AIInterviewSession.create({
            sessionId,
            interviewId: interview._id,
            candidateId: interview.candidateId,
            jobId: job._id || job,
            companyId: comp._id || comp,
            jobTitle: job.title || 'Position',
            companyName: comp.name || 'Company',
            jobDescription: job.description || '',
            requiredSkills: job.skills || [],
            interviewRound: interview.round || 'L1',
            difficulty,
            totalQuestions: Math.min(Math.max(Number(numQuestions), 3), 12),
            expiresAt,
            proctoringEnabled: interview.proctoringEnabled ?? true,
        });
        const sessionUrl = `${config_1.default.frontendUrl}/ai-interview/${sessionId}`;
        logger_1.default.info(`AI Interview session created: ${sessionId} for interview ${interviewId}`);
        (0, response_1.sendSuccess)(res, { sessionId, sessionUrl, expiresAt }, 'AI interview session created', 201);
    }
    catch (error) {
        logger_1.default.error('createSession error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to create AI interview session', 500);
    }
};
exports.createSession = createSession;
/**
 * @desc  Get public session info (no auth — session token IS the credential)
 * @route GET /api/v1/ai-interviews/session/:sessionId
 */
const getSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await resolveSession(sessionId);
        if (!session) {
            (0, response_1.sendError)(res, 'Interview session not found or has expired', 404);
            return;
        }
        // Return only what the frontend needs — never return questions ahead of time
        (0, response_1.sendSuccess)(res, {
            sessionId: session.sessionId,
            jobTitle: session.jobTitle,
            companyName: session.companyName,
            interviewRound: session.interviewRound,
            difficulty: session.difficulty,
            totalQuestions: session.totalQuestions,
            status: session.status,
            expiresAt: session.expiresAt,
            proctoringEnabled: session.proctoringEnabled,
            consentGiven: session.consentGiven,
            currentQuestionIndex: session.currentQuestionIndex,
            responsesCount: session.responses.length,
        }, 'Session retrieved');
    }
    catch (error) {
        logger_1.default.error('getSession error:', error);
        (0, response_1.sendError)(res, 'Failed to retrieve session', 500);
    }
};
exports.getSession = getSession;
/**
 * @desc  Candidate gives consent and starts the interview — generates questions via LLM
 * @route POST /api/v1/ai-interviews/session/:sessionId/start
 */
const startSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { consentGiven } = req.body;
        if (!consentGiven) {
            (0, response_1.sendError)(res, 'You must provide consent before starting the interview', 400);
            return;
        }
        const session = await resolveSession(sessionId);
        if (!session) {
            (0, response_1.sendError)(res, 'Session not found or expired', 404);
            return;
        }
        if (session.status === 'completed') {
            (0, response_1.sendError)(res, 'This interview has already been completed', 400);
            return;
        }
        if (session.status === 'in_progress' && session.questions.length > 0) {
            // Resume: return the current question
            const q = session.questions[session.currentQuestionIndex];
            (0, response_1.sendSuccess)(res, {
                question: q,
                questionNumber: session.currentQuestionIndex + 1,
                totalQuestions: session.totalQuestions,
                resumed: true,
            }, 'Session resumed');
            return;
        }
        // Generate questions via LLM service
        let questions = [];
        try {
            const llmRes = await llm.post('/api/generate-questions', {
                job_title: session.jobTitle,
                job_description: session.jobDescription || session.jobTitle,
                required_skills: session.requiredSkills,
                interview_round: session.interviewRound,
                difficulty: session.difficulty,
                num_questions: session.totalQuestions,
            });
            const raw = llmRes.data?.questions || [];
            questions = raw.map((q, i) => ({
                id: q.id || `q${i + 1}`,
                text: q.text || 'Tell me about yourself.',
                type: q.type || 'behavioral',
                expectedDurationSeconds: Number(q.expected_duration_seconds) || 150,
                orderIndex: Number(q.order_index) || i + 1,
            }));
        }
        catch (llmErr) {
            logger_1.default.warn(`LLM question generation failed, using fallback: ${llmErr.message}`);
            questions = buildFallbackQuestions(session.jobTitle, session.totalQuestions);
        }
        // Persist and transition state
        await AIInterviewSession_1.AIInterviewSession.updateOne({ sessionId }, {
            status: 'in_progress',
            consentGiven: true,
            consentGivenAt: new Date(),
            startedAt: new Date(),
            questions,
            currentQuestionIndex: 0,
            totalQuestions: questions.length,
        });
        // Also mark the linked Interview as in_progress
        await models_1.Interview.findByIdAndUpdate(session.interviewId, {
            status: types_1.InterviewStatus.IN_PROGRESS,
            startedAt: new Date(),
        });
        logger_1.default.info(`AI Interview started: session ${sessionId}`);
        (0, response_1.sendSuccess)(res, {
            question: questions[0],
            questionNumber: 1,
            totalQuestions: questions.length,
        }, 'Interview started');
    }
    catch (error) {
        logger_1.default.error('startSession error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to start session', 500);
    }
};
exports.startSession = startSession;
/**
 * @desc  Candidate submits an answer; LLM evaluates it and returns the next question
 * @route POST /api/v1/ai-interviews/session/:sessionId/answer
 */
const submitAnswer = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { questionId, responseText, responseTimeSeconds = 0 } = req.body;
        if (!questionId || !responseText?.trim()) {
            (0, response_1.sendError)(res, 'questionId and responseText are required', 400);
            return;
        }
        const session = await resolveSession(sessionId);
        if (!session) {
            (0, response_1.sendError)(res, 'Session not found or expired', 404);
            return;
        }
        if (session.status !== 'in_progress') {
            (0, response_1.sendError)(res, 'Session is not in progress', 400);
            return;
        }
        // Validate the submitted questionId matches current expected
        const expectedQ = session.questions[session.currentQuestionIndex];
        if (!expectedQ) {
            (0, response_1.sendError)(res, 'No more questions in this session', 400);
            return;
        }
        if (expectedQ.id !== questionId) {
            (0, response_1.sendError)(res, 'questionId does not match the current question', 400);
            return;
        }
        // Evaluate via LLM service
        let scores = { technicalAccuracy: 5, communicationClarity: 5, confidence: 5, overall: 5 };
        let feedback = 'Thank you for your response.';
        let improveTip = 'Try to support your answer with specific examples from past experience.';
        let passed = true;
        try {
            const evalRes = await llm.post('/api/evaluate-response', {
                job_title: session.jobTitle,
                required_skills: session.requiredSkills,
                question: expectedQ.text,
                question_type: expectedQ.type,
                response_text: responseText.trim(),
                response_time_seconds: Number(responseTimeSeconds),
            });
            const d = evalRes.data;
            scores = {
                technicalAccuracy: Number(d.technical_accuracy) || 5,
                communicationClarity: Number(d.communication_clarity) || 5,
                confidence: Number(d.confidence) || 5,
                overall: Number(d.overall_score) || 5,
            };
            feedback = d.feedback || feedback;
            improveTip = d.improvement_tip || improveTip;
            passed = d.passed !== undefined ? Boolean(d.passed) : scores.overall >= 6;
        }
        catch (llmErr) {
            logger_1.default.warn(`LLM evaluation failed, using fallback: ${llmErr.message}`);
        }
        const responseRecord = {
            questionId,
            questionText: expectedQ.text,
            responseText: responseText.trim(),
            responseTimeSeconds: Number(responseTimeSeconds),
            scores,
            feedback,
            improvementTip: improveTip,
            passed,
            answeredAt: new Date(),
        };
        const nextIndex = session.currentQuestionIndex + 1;
        const isComplete = nextIndex >= session.questions.length;
        const update = {
            $push: { responses: responseRecord },
            $set: { currentQuestionIndex: nextIndex },
        };
        let analysis;
        if (isComplete) {
            const allResponses = [...session.responses, responseRecord];
            analysis = buildAnalysis(allResponses, session.questions.length);
            update.$set.status = 'completed';
            update.$set.completedAt = new Date();
            update.$set.analysis = analysis;
            // Sync back to Interview and Application
            await models_1.Interview.findByIdAndUpdate(session.interviewId, {
                status: types_1.InterviewStatus.COMPLETED,
                completedAt: new Date(),
                overallRating: Math.round(analysis.overallScore / 10), // 1-10
                finalDecision: analysis.recommendation === 'strong_hire' || analysis.recommendation === 'hire'
                    ? 'selected' : analysis.recommendation === 'hold' ? 'on_hold' : 'rejected',
                $push: {
                    feedback: {
                        interviewerId: session.candidateId,
                        rating: Math.round(analysis.overallScore / 10),
                        comments: analysis.summary,
                        recommendation: analysis.recommendation,
                        submittedAt: new Date(),
                    },
                },
            });
            await models_1.Application.findByIdAndUpdate(await models_1.Interview.findById(session.interviewId).select('applicationId').lean().then(i => i?.applicationId), { status: types_1.ApplicationStatus.IN_PROGRESS });
        }
        await AIInterviewSession_1.AIInterviewSession.updateOne({ sessionId }, update);
        const nextQuestion = isComplete ? null : session.questions[nextIndex];
        (0, response_1.sendSuccess)(res, {
            score: {
                technical_accuracy: scores.technicalAccuracy,
                communication_clarity: scores.communicationClarity,
                confidence: scores.confidence,
                overall: scores.overall,
            },
            feedback,
            improvementTip: improveTip,
            passed,
            nextQuestion,
            questionNumber: nextIndex + 1,
            totalQuestions: session.questions.length,
            isComplete,
            ...(isComplete && { analysis }),
        }, isComplete ? 'Interview complete' : 'Answer recorded');
    }
    catch (error) {
        logger_1.default.error('submitAnswer error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to submit answer', 500);
    }
};
exports.submitAnswer = submitAnswer;
/**
 * @desc  Explicitly complete a session (called if candidate exits early or connection drops)
 * @route POST /api/v1/ai-interviews/session/:sessionId/complete
 */
const completeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await resolveSession(sessionId);
        if (!session) {
            (0, response_1.sendError)(res, 'Session not found or expired', 404);
            return;
        }
        if (session.status === 'completed') {
            (0, response_1.sendSuccess)(res, { analysis: session.analysis }, 'Session already completed');
            return;
        }
        const analysis = buildAnalysis(session.responses, session.totalQuestions);
        await AIInterviewSession_1.AIInterviewSession.updateOne({ sessionId }, { status: 'completed', completedAt: new Date(), analysis });
        await models_1.Interview.findByIdAndUpdate(session.interviewId, {
            status: types_1.InterviewStatus.COMPLETED,
            completedAt: new Date(),
        });
        (0, response_1.sendSuccess)(res, { analysis }, 'Interview session completed');
    }
    catch (error) {
        logger_1.default.error('completeSession error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to complete session', 500);
    }
};
exports.completeSession = completeSession;
/**
 * @desc  HR/Admin: get full session detail including responses and analysis
 * @route GET /api/v1/ai-interviews/:interviewId/session
 * @auth  JWT required
 */
const getSessionForReview = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const session = await AIInterviewSession_1.AIInterviewSession.findOne({ interviewId }).lean();
        if (!session) {
            (0, response_1.sendError)(res, 'No AI session found for this interview', 404);
            return;
        }
        if (tenantId && session.companyId?.toString() !== tenantId) {
            (0, response_1.sendError)(res, 'Not authorised to view this session', 403);
            return;
        }
        (0, response_1.sendSuccess)(res, session, 'Session retrieved');
    }
    catch (error) {
        logger_1.default.error('getSessionForReview error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to retrieve session', 500);
    }
};
exports.getSessionForReview = getSessionForReview;
// ─── Internal: fallback question bank ────────────────────────────────────────
function buildFallbackQuestions(jobTitle, count) {
    const pool = [
        { text: `Tell me about your experience relevant to the ${jobTitle} role.`, type: 'behavioral', expectedDurationSeconds: 150 },
        { text: 'Describe a technically challenging project you have worked on. What was your specific contribution?', type: 'technical', expectedDurationSeconds: 180 },
        { text: 'How do you approach debugging a critical production issue you have never encountered before?', type: 'situational', expectedDurationSeconds: 150 },
        { text: 'Walk me through your understanding of building scalable, maintainable systems.', type: 'technical', expectedDurationSeconds: 210 },
        { text: 'Tell me about a time you had a disagreement with a colleague. How did you handle it?', type: 'behavioral', expectedDurationSeconds: 120 },
        { text: 'How do you prioritise tasks when working under tight deadlines with multiple competing demands?', type: 'situational', expectedDurationSeconds: 120 },
        { text: 'What are your strongest technical skills, and how do they directly apply to this role?', type: 'technical', expectedDurationSeconds: 150 },
        { text: 'Where do you see yourself growing professionally in the next two to three years?', type: 'hr', expectedDurationSeconds: 90 },
        { text: 'How do you stay current with new technologies and industry trends?', type: 'behavioral', expectedDurationSeconds: 90 },
        { text: 'Describe a situation where you had to quickly learn something new to complete a deliverable.', type: 'situational', expectedDurationSeconds: 120 },
    ];
    return pool.slice(0, Math.min(count, pool.length)).map((q, i) => ({
        ...q,
        id: `fq${i + 1}`,
        orderIndex: i + 1,
    }));
}
//# sourceMappingURL=aiInterviewController.js.map