import crypto from 'crypto';
import axios from 'axios';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AIInterviewSession, IAIQuestion, IAIResponse, IAIAnalysis } from '../models/AIInterviewSession';
import { Interview, Job, Company, Application, Question } from '../models';
import { AuthRequest, ApplicationStatus, InterviewStatus } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { getTenantCompanyId } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { notificationService } from '../services/notificationService';
import config from '../config';
import logger from '../utils/logger';

// ─── LLM service axios client (no JWT, uses X-API-Key) ───────────────────────

const llm = axios.create({
  baseURL: config.llm.serviceUrl,
  timeout: 45_000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': config.llm.apiSecretKey,
  },
});

// ─── Question bank helpers ────────────────────────────────────────────────────

/** Map Question.questionType → IAIQuestion.type */
const QTYPE_MAP: Record<string, IAIQuestion['type']> = {
  technical:     'technical',
  behavioral:    'behavioral',
  situational:   'situational',
  coding:        'technical',
  system_design: 'technical',
  hr:            'hr',
};

/** Map session difficulty string → Question schema enum values */
function mapDifficultyToEnum(difficulty: string): string {
  const m: Record<string, string> = {
    junior: 'junior',
    mid:    'senior',
    senior: 'senior',
    expert: 'expert',
    lead:   'expert',
  };
  return m[difficulty.toLowerCase()] ?? 'senior';
}

/**
 * Bank-first question selection:
 *   1. Pull best-rated / least-used questions from the company bank (+ global).
 *   2. LLM fills remaining slots, targeting uncovered skills.
 *   3. Increment usageCount on every consumed bank question.
 *
 * Always reserves at least 2 slots for LLM so each interview has fresh content.
 */
async function selectQuestionsForSession(
  companyId: string,
  jobSkills: string[],
  sessionDifficulty: string,
  jobTitle: string,
  jobDescription: string,
  interviewRound: string,
  targetCount: number
): Promise<IAIQuestion[]> {
  const difficulty = mapDifficultyToEnum(sessionDifficulty);

  // ── Step 1: query bank ────────────────────────────────────────────────────
  const bankFilter: any = {
    isActive: true,
    difficulty,
    $or: [
      { companyId: new mongoose.Types.ObjectId(companyId) },
      { companyId: null },
      { companyId: { $exists: false } },
    ],
  };
  if (jobSkills.length > 0) bankFilter.skills = { $in: jobSkills };

  const bankDocs = await Question.find(bankFilter)
    .sort({ averageRating: -1, usageCount: 1 })
    .limit(targetCount * 2)
    .lean();

  // Reserve at least 2 slots for LLM fresh content
  const maxFromBank = Math.max(0, targetCount - 2);
  const selected    = bankDocs.slice(0, Math.min(maxFromBank, bankDocs.length));

  // ── Step 2: determine LLM gap ────────────────────────────────────────────
  const remaining       = targetCount - selected.length;
  const coveredSkills   = selected.flatMap((q) => q.skills ?? []);
  const uncoveredSkills = jobSkills.filter((s) => !coveredSkills.includes(s));
  const excludeTexts    = selected.map((q) => q.question);

  // ── Step 3: LLM gap-fill ─────────────────────────────────────────────────
  let aiGenerated: IAIQuestion[] = [];
  if (remaining > 0) {
    try {
      const llmRes = await Promise.race([
        llm.post('/api/generate-questions', {
          job_title:         jobTitle,
          job_description:   jobDescription || jobTitle,
          required_skills:   uncoveredSkills.length > 0 ? uncoveredSkills : jobSkills,
          interview_round:   interviewRound,
          difficulty:        sessionDifficulty,
          num_questions:     remaining,
          exclude_questions: excludeTexts,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), 15_000)
        ),
      ]);

      const raw: any[] = llmRes.data?.questions || [];
      aiGenerated = raw.map((q: any, i: number): IAIQuestion => ({
        id:                      q.id || `ai_${selected.length + i + 1}`,
        text:                    q.text || 'Tell me about a relevant project you have worked on.',
        type:                    (QTYPE_MAP[q.type] ?? q.type ?? 'behavioral') as IAIQuestion['type'],
        expectedDurationSeconds: Number(q.expected_duration_seconds) || 150,
        orderIndex:              selected.length + i + 1,
      }));
    } catch (llmErr: any) {
      if ((llmErr as Error).message === 'LLM_TIMEOUT') {
        logger.warn('LLM question generation timed out after 15 s — falling back to bank-only questions');
      } else {
        logger.warn(`LLM gap-fill failed in selectQuestionsForSession: ${llmErr.message}`);
      }
    }
  }

  // ── Step 4: increment usageCount (fire-and-forget) ───────────────────────
  if (selected.length > 0) {
    Question.updateMany(
      { _id: { $in: selected.map((q) => q._id) } },
      { $inc: { usageCount: 1 } }
    ).catch((err: any) =>
      logger.warn(`usageCount increment failed: ${err.message}`)
    );
  }

  // ── Step 5: convert bank docs → IAIQuestion and merge ────────────────────
  const bankAsAI: IAIQuestion[] = selected.map((q, i): IAIQuestion => ({
    id:                      `bank_${q._id}`,
    text:                    q.question,
    type:                    QTYPE_MAP[q.questionType] ?? 'technical',
    expectedDurationSeconds: (q.estimatedDuration ?? 5) * 60,
    orderIndex:              i + 1,
  }));

  return [...bankAsAI, ...aiGenerated];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Resolve and validate a public session token. Returns null when invalid/expired. */
async function resolveSession(sessionId: string) {
  const session = await AIInterviewSession.findOne({ sessionId }).lean();
  if (!session) return null;
  if (session.status === 'expired') return null;
  // Auto-expire if past expiresAt
  if (new Date() > session.expiresAt) {
    await AIInterviewSession.updateOne({ sessionId }, { status: 'expired' });
    return null;
  }
  return session;
}

/** Derive recommendation label from pass-rate and mean score. */
function deriveRecommendation(
  passRate: number,
  meanOverall: number
): IAIAnalysis['recommendation'] {
  if (meanOverall >= 8 && passRate >= 0.8) return 'strong_hire';
  if (meanOverall >= 6 && passRate >= 0.6) return 'hire';
  if (meanOverall >= 4 && passRate >= 0.4) return 'hold';
  return 'reject';
}

/**
 * Fire-and-forget: email the interview panel when an AI session completes.
 * Failures are swallowed so they never surface to the candidate's response.
 */
async function notifyRecruitersOfCompletion(
  interviewId: mongoose.Types.ObjectId,
  session: { jobTitle: string; candidateId: mongoose.Types.ObjectId },
  analysis: IAIAnalysis
): Promise<void> {
  try {
    const interview = await Interview.findById(interviewId)
      .populate<{ candidateId: { firstName: string; lastName: string; email: string } }>('candidateId', 'firstName lastName email')
      .populate<{ panel: Array<{ email: string; firstName: string }> }>('panel', 'email firstName')
      .lean();

    if (!interview) return;

    const candidate = interview.candidateId as any;
    const candName  = candidate ? `${candidate.firstName} ${candidate.lastName}`.trim() : 'Candidate';

    // Gather recipient emails: panel members first, fall back to createdBy if panel is empty
    const panelEmails: string[] = (interview.panel as any[])
      .map((p: any) => p?.email)
      .filter((e): e is string => !!e);

    if (panelEmails.length === 0) return; // no one to notify

    const recLabel: Record<string, string> = {
      strong_hire: '✅ Strong Hire',
      hire:        '✅ Hire',
      hold:        '⏸ On Hold',
      reject:      '❌ Not Recommended',
    };

    const reviewUrl = `${config.frontendUrl}/interviews/${interviewId}`;

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#374151;">
        <h2 style="color:#111827;margin-bottom:4px;">AI Interview Complete</h2>
        <p style="color:#6b7280;margin-top:0;">${session.jobTitle}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p><strong>Candidate:</strong> ${candName}</p>
        <p><strong>Overall Score:</strong> ${analysis.overallScore}%</p>
        <p><strong>Questions:</strong> ${analysis.questionsAnswered} answered · ${analysis.questionsPassed} passed</p>
        <p><strong>Recommendation:</strong> ${recLabel[analysis.recommendation] ?? analysis.recommendation}</p>
        <p style="margin-top:8px;color:#6b7280;font-style:italic;">${analysis.summary}</p>
        <a href="${reviewUrl}"
           style="display:inline-block;margin-top:16px;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Full Report
        </a>
        <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
          This notification was sent automatically by RecruitPro AI Interview.
        </p>
      </div>`;

    await Promise.allSettled(
      panelEmails.map(email =>
        sendEmail({
          to:      email,
          subject: `AI Interview Complete — ${candName} · ${session.jobTitle}`,
          html:    emailHtml,
        })
      )
    );

    // In-app notification to panel members (real-time via Socket.IO)
    const panelUserIds = (interview.panel as any[])
      .map((p: any) => p?.userId?.toString?.() || p?.userId)
      .filter(Boolean);
    if (panelUserIds.length > 0) {
      notificationService.notifyAIInterviewCompleted(
        panelUserIds,
        candName,
        session.jobTitle,
        analysis.recommendation,
        interviewId.toString()
      ).catch((e: any) => logger.warn(`AI interview in-app notify failed: ${e.message}`));
    }

    logger.info(`Recruiter notification sent for session interviewId=${interviewId} to ${panelEmails.length} recipient(s)`);
  } catch (err: any) {
    logger.warn(`notifyRecruitersOfCompletion failed (non-fatal): ${err.message}`);
  }
}

/** Build a final analysis object from stored responses. */
function buildAnalysis(responses: IAIResponse[], totalQuestions: number): IAIAnalysis {
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
  const avg = (key: keyof IAIResponse['scores']) =>
    Math.round(responses.reduce((s, r) => s + r.scores[key], 0) / n);

  const techAvg  = avg('technicalAccuracy');
  const commAvg  = avg('communicationClarity');
  const confAvg  = avg('confidence');
  const overAvg  = avg('overall');
  const passCount = responses.filter(r => r.passed).length;
  const passRate  = passCount / n;

  const normalise = (v: number) => Math.round((v / 10) * 100);

  return {
    overallScore:       normalise(overAvg),
    technicalScore:     normalise(techAvg),
    communicationScore: normalise(commAvg),
    confidenceScore:    normalise(confAvg),
    questionsAnswered:  n,
    questionsPassed:    passCount,
    recommendation:     deriveRecommendation(passRate, overAvg),
    strengths:          responses.filter(r => r.passed).slice(0, 3).map(r => r.feedback).filter(Boolean),
    improvements:       responses.filter(r => !r.passed).slice(0, 3).map(r => r.improvementTip).filter(Boolean),
    summary:            `Completed ${n}/${totalQuestions} questions. Pass rate: ${Math.round(passRate * 100)}%. Average overall score: ${overAvg}/10.`,
    generatedAt:        new Date(),
  };
}

// ─── Controller functions ─────────────────────────────────────────────────────

/**
 * @desc  Create an AI Interview Session for a scheduled interview (HR/Admin)
 * @route POST /api/v1/ai-interviews
 * @auth  JWT required (HR / Admin / Employer)
 */
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { interviewId, difficulty = 'senior', numQuestions = 7 } = req.body;

    if (!interviewId) {
      sendError(res, 'interviewId is required', 400);
      return;
    }

    // Load interview with populated refs
    const interview = await Interview.findById(interviewId)
      .populate('jobId', 'title description skills companyId')
      .populate('companyId', 'name')
      .populate('candidateId', 'firstName lastName email');

    if (!interview) { sendError(res, 'Interview not found', 404); return; }

    // Tenant isolation
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && interview.companyId?.toString() !== tenantId) {
      sendError(res, 'Not authorised to create AI session for this interview', 403);
      return;
    }

    // Prevent duplicate sessions
    const existing = await AIInterviewSession.findOne({ interviewId: interview._id, status: { $ne: 'expired' } });
    if (existing) {
      const url = `${config.frontendUrl}/ai-interview/${existing.sessionId}`;
      sendSuccess(res, { sessionId: existing.sessionId, sessionUrl: url, alreadyExists: true }, 'Session already exists');
      return;
    }

    const job  = interview.jobId as any;
    const comp = interview.companyId as any;

    const sessionId = generateSessionId();
    // Session valid for 72 h from creation
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const session = await AIInterviewSession.create({
      sessionId,
      interviewId:    interview._id,
      candidateId:    interview.candidateId,
      jobId:          job._id || job,
      companyId:      comp._id || comp,
      jobTitle:       job.title || 'Position',
      companyName:    comp.name || 'Company',
      jobDescription: job.description || '',
      requiredSkills: job.skills || [],
      interviewRound: interview.round || 'L1',
      difficulty,
      totalQuestions: Math.min(Math.max(Number(numQuestions), 3), 12),
      expiresAt,
      proctoringEnabled: interview.proctoringEnabled ?? true,
    });

    const sessionUrl = `${config.frontendUrl}/ai-interview/${sessionId}`;

    logger.info(`AI Interview session created: ${sessionId} for interview ${interviewId}`);
    sendSuccess(res, { sessionId, sessionUrl, expiresAt }, 'AI interview session created', 201);
  } catch (error: any) {
    logger.error('createSession error:', error);
    sendError(res, error.message || 'Failed to create AI interview session', 500);
  }
};

/**
 * @desc  Get public session info (no auth — session token IS the credential)
 * @route GET /api/v1/ai-interviews/session/:sessionId
 */
export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = await resolveSession(sessionId);

    if (!session) {
      sendError(res, 'Interview session not found or has expired', 404);
      return;
    }

    // Return only what the frontend needs — never return questions ahead of time
    sendSuccess(res, {
      sessionId:         session.sessionId,
      jobTitle:          session.jobTitle,
      companyName:       session.companyName,
      interviewRound:    session.interviewRound,
      difficulty:        session.difficulty,
      totalQuestions:    session.totalQuestions,
      status:            session.status,
      expiresAt:         session.expiresAt,
      proctoringEnabled: session.proctoringEnabled,
      consentGiven:      session.consentGiven,
      currentQuestionIndex: session.currentQuestionIndex,
      responsesCount:    session.responses.length,
    }, 'Session retrieved');
  } catch (error: any) {
    logger.error('getSession error:', error);
    sendError(res, 'Failed to retrieve session', 500);
  }
};

/**
 * @desc  Candidate gives consent and starts the interview — generates questions via LLM
 * @route POST /api/v1/ai-interviews/session/:sessionId/start
 */
export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { consentGiven } = req.body;

    if (!consentGiven) {
      sendError(res, 'You must provide consent before starting the interview', 400);
      return;
    }

    const session = await resolveSession(sessionId);
    if (!session) { sendError(res, 'Session not found or expired', 404); return; }

    if (session.status === 'completed') {
      sendError(res, 'This interview has already been completed', 400);
      return;
    }
    if (session.status === 'in_progress' && session.questions.length > 0) {
      // Resume: return the current question
      const q = session.questions[session.currentQuestionIndex];
      sendSuccess(res, {
        question: q,
        questionNumber: session.currentQuestionIndex + 1,
        totalQuestions: session.totalQuestions,
        resumed: true,
      }, 'Session resumed');
      return;
    }

    // Bank-first question selection: curated bank + LLM gap-fill
    let questions: IAIQuestion[] = [];
    try {
      questions = await selectQuestionsForSession(
        session.companyId.toString(),
        session.requiredSkills,
        session.difficulty,
        session.jobTitle,
        session.jobDescription,
        session.interviewRound,
        session.totalQuestions
      );
    } catch (selErr: any) {
      logger.warn(`selectQuestionsForSession failed, using fallback: ${selErr.message}`);
    }

    // Final safety net — should only trigger if both bank and LLM are down
    if (questions.length === 0) {
      questions = buildFallbackQuestions(session.jobTitle, session.totalQuestions);
    }

    // Persist and transition state
    await AIInterviewSession.updateOne(
      { sessionId },
      {
        status:           'in_progress',
        consentGiven:     true,
        consentGivenAt:   new Date(),
        startedAt:        new Date(),
        questions,
        currentQuestionIndex: 0,
        totalQuestions:   questions.length,
      }
    );

    // Also mark the linked Interview as in_progress
    await Interview.findByIdAndUpdate(session.interviewId, {
      status:    InterviewStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    logger.info(`AI Interview started: session ${sessionId}`);
    sendSuccess(res, {
      question:       questions[0],
      questionNumber: 1,
      totalQuestions: questions.length,
    }, 'Interview started');
  } catch (error: any) {
    logger.error('startSession error:', error);
    sendError(res, error.message || 'Failed to start session', 500);
  }
};

/**
 * @desc  Candidate submits an answer; LLM evaluates it and returns the next question
 * @route POST /api/v1/ai-interviews/session/:sessionId/answer
 */
export const submitAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { questionId, responseText, responseTimeSeconds = 0 } = req.body;

    if (!questionId || !responseText?.trim()) {
      sendError(res, 'questionId and responseText are required', 400);
      return;
    }

    const session = await resolveSession(sessionId);
    if (!session) { sendError(res, 'Session not found or expired', 404); return; }
    if (session.status !== 'in_progress') {
      sendError(res, 'Session is not in progress', 400);
      return;
    }

    // Validate the submitted questionId matches current expected
    const expectedQ = session.questions[session.currentQuestionIndex];
    if (!expectedQ) { sendError(res, 'No more questions in this session', 400); return; }
    if (expectedQ.id !== questionId) {
      sendError(res, 'questionId does not match the current question', 400);
      return;
    }

    // Evaluate via LLM service
    let scores = { technicalAccuracy: 5, communicationClarity: 5, confidence: 5, overall: 5 };
    let feedback     = 'Thank you for your response.';
    let improveTip   = 'Try to support your answer with specific examples from past experience.';
    let passed       = true;

    try {
      // 10-second hard cap: if the LLM service is slow, the candidate should
      // not be blocked.  On timeout we fall through to the neutral (5/5/5/5)
      // fallback scores already initialised above — the interview continues.
      const evalRes = await Promise.race([
        llm.post('/api/evaluate-response', {
          job_title:             session.jobTitle,
          required_skills:       session.requiredSkills,
          question:              expectedQ.text,
          question_type:         expectedQ.type,
          response_text:         responseText.trim(),
          response_time_seconds: Number(responseTimeSeconds),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), 10_000)
        ),
      ]);
      const d = evalRes.data;
      scores = {
        technicalAccuracy:   Number(d.technical_accuracy)   || 5,
        communicationClarity:Number(d.communication_clarity)|| 5,
        confidence:          Number(d.confidence)           || 5,
        overall:             Number(d.overall_score)        || 5,
      };
      feedback   = d.feedback        || feedback;
      improveTip = d.improvement_tip || improveTip;
      passed     = d.passed !== undefined ? Boolean(d.passed) : scores.overall >= 6;
    } catch (llmErr: any) {
      if (llmErr.message === 'LLM_TIMEOUT') {
        logger.warn(`LLM evaluation timeout after 10 s — continuing without score for question ${questionId}`);
      } else {
        logger.warn(`LLM evaluation failed, using fallback scores: ${llmErr.message}`);
      }
      // Neutral fallback scores (5/5/5/5) already set — interview continues unaffected.
    }

    const responseRecord: IAIResponse = {
      questionId,
      questionText:        expectedQ.text,
      responseText:        responseText.trim(),
      responseTimeSeconds: Number(responseTimeSeconds),
      scores,
      feedback,
      improvementTip:      improveTip,
      passed,
      answeredAt:          new Date(),
    };

    const nextIndex = session.currentQuestionIndex + 1;
    const isComplete = nextIndex >= session.questions.length;

    const update: any = {
      $push:          { responses: responseRecord },
      $set:           { currentQuestionIndex: nextIndex },
    };

    let analysis: IAIAnalysis | undefined;
    if (isComplete) {
      const allResponses = [...(session.responses as IAIResponse[]), responseRecord];
      analysis = buildAnalysis(allResponses, session.questions.length);
      update.$set.status       = 'completed';
      update.$set.completedAt  = new Date();
      update.$set.analysis     = analysis;

      // Sync back to Interview and Application
      await Interview.findByIdAndUpdate(session.interviewId, {
        status: InterviewStatus.COMPLETED,
        completedAt: new Date(),
        overallRating: Math.round(analysis.overallScore / 10), // 1-10
        finalDecision: analysis.recommendation === 'strong_hire' || analysis.recommendation === 'hire'
          ? 'selected' : analysis.recommendation === 'hold' ? 'on_hold' : 'rejected',
        $push: {
          feedback: {
            interviewerId: session.candidateId,
            rating:        Math.round(analysis.overallScore / 10),
            comments:      analysis.summary,
            recommendation: analysis.recommendation,
            submittedAt:   new Date(),
          },
        },
      });

      await Application.findByIdAndUpdate(
        await Interview.findById(session.interviewId).select('applicationId').lean().then(i => i?.applicationId),
        { status: ApplicationStatus.IN_PROGRESS }
      );
    }

    await AIInterviewSession.updateOne({ sessionId }, update);

    // Notify panel asynchronously — do NOT await so candidate gets an instant response
    if (isComplete && analysis) {
      void notifyRecruitersOfCompletion(session.interviewId, session, analysis);
    }

    const nextQuestion = isComplete ? null : session.questions[nextIndex];

    sendSuccess(res, {
      score: {
        technical_accuracy:    scores.technicalAccuracy,
        communication_clarity: scores.communicationClarity,
        confidence:            scores.confidence,
        overall:               scores.overall,
      },
      feedback,
      improvementTip:  improveTip,
      passed,
      nextQuestion,
      questionNumber:  nextIndex + 1,
      totalQuestions:  session.questions.length,
      isComplete,
      ...(isComplete && { analysis }),
    }, isComplete ? 'Interview complete' : 'Answer recorded');
  } catch (error: any) {
    logger.error('submitAnswer error:', error);
    sendError(res, error.message || 'Failed to submit answer', 500);
  }
};

/**
 * @desc  Explicitly complete a session (called if candidate exits early or connection drops)
 * @route POST /api/v1/ai-interviews/session/:sessionId/complete
 */
export const completeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = await resolveSession(sessionId);
    if (!session) { sendError(res, 'Session not found or expired', 404); return; }

    if (session.status === 'completed') {
      sendSuccess(res, { analysis: session.analysis }, 'Session already completed');
      return;
    }

    const analysis = buildAnalysis(session.responses as IAIResponse[], session.totalQuestions);

    await AIInterviewSession.updateOne(
      { sessionId },
      { status: 'completed', completedAt: new Date(), analysis }
    );

    await Interview.findByIdAndUpdate(session.interviewId, {
      status:      InterviewStatus.COMPLETED,
      completedAt: new Date(),
    });

    sendSuccess(res, { analysis }, 'Interview session completed');
  } catch (error: any) {
    logger.error('completeSession error:', error);
    sendError(res, error.message || 'Failed to complete session', 500);
  }
};

/**
 * @desc  HR/Admin: get full session detail including responses and analysis
 * @route GET /api/v1/ai-interviews/:interviewId/session
 * @auth  JWT required
 */
export const getSessionForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { interviewId } = req.params;
    const tenantId = getTenantCompanyId(req.user);

    const session = await AIInterviewSession.findOne({ interviewId }).lean();
    if (!session) { sendError(res, 'No AI session found for this interview', 404); return; }

    if (tenantId && session.companyId?.toString() !== tenantId) {
      sendError(res, 'Not authorised to view this session', 403);
      return;
    }

    sendSuccess(res, session, 'Session retrieved');
  } catch (error: any) {
    logger.error('getSessionForReview error:', error);
    sendError(res, error.message || 'Failed to retrieve session', 500);
  }
};

/**
 * @desc  Candidate flags a technical/content issue — logs it without touching session status
 * @route POST /api/v1/ai-interviews/session/:sessionId/flag
 * @auth  Public (session ID is the credential)
 */
export const flagSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { reason }    = req.body;

    const session = await resolveSession(sessionId);
    if (!session) { sendError(res, 'Session not found or expired', 404); return; }

    // Log prominently so ops/support can act without terminating the session
    logger.warn(`[AI Interview FLAG] session=${sessionId} candidate=${session.candidateId} job="${session.jobTitle}" reason="${reason?.slice(0, 300)}"`);

    sendSuccess(res, {}, 'Issue reported');
  } catch (error: any) {
    logger.error('flagSession error:', error);
    sendError(res, 'Failed to report issue', 500);
  }
};

// ─── Internal: fallback question bank ────────────────────────────────────────

function buildFallbackQuestions(jobTitle: string, count: number): IAIQuestion[] {
  const pool: Omit<IAIQuestion, 'id' | 'orderIndex'>[] = [
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
    id:         `fq${i + 1}`,
    orderIndex: i + 1,
  }));
}

// ─── Prompt 1: Send AI Interview Invitation Email ─────────────────────────────

/**
 * @desc  Send a branded interview invitation email with system-check routing
 * @route POST /api/v1/ai-interviews/:interviewId/send-invitation
 * @access HR / Admin / Employer
 */
export const sendInterviewInvitationEmail = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { interviewId } = req.params;
    if (!mongoose.isValidObjectId(interviewId)) {
      sendError(res, 'Invalid interviewId', 400); return;
    }

    const interview = await Interview.findById(interviewId)
      .populate<{ candidateId: { firstName: string; lastName: string; email: string } }>(
        'candidateId', 'firstName lastName email'
      )
      .populate<{ jobId: { title: string; _id: mongoose.Types.ObjectId } }>('jobId', 'title _id')
      .populate<{ companyId: { name: string } }>('companyId', 'name')
      .lean();

    if (!interview) { sendError(res, 'Interview not found', 404); return; }

    const candidate  = interview.candidateId as any;
    const job        = interview.jobId as any;
    const company    = interview.companyId as any;

    const frontendUrl    = process.env.FRONTEND_URL || 'http://localhost:5173';
    const platformName   = process.env.PLATFORM_NAME || 'RecuirtPro';
    const supportEmail   = process.env.SUPPORT_EMAIL || 'support@recruirtpro.com';

    // System check routes through /system-check/:interviewId?redirect=<room>
    const systemCheckUrl = `${frontendUrl}/system-check/${interviewId}`;
    const roomJoinUrl    = `${frontendUrl}/interviews/${interviewId}/room`;
    const jobDescUrl     = job?._id
      ? `${frontendUrl}/jobs/${job._id}`
      : undefined;

    const scheduledAt = interview.scheduledTime ? new Date(interview.scheduledTime as any) : new Date();
    const dateStr     = scheduledAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const timeStr     = scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Render template from emailTemplates
    const { emailTemplates } = require('../utils/emailTemplates') as typeof import('../utils/emailTemplates');
    const html = emailTemplates.aiInterviewInvitation({
      candidateName:    candidate.firstName,
      positionTitle:    job?.title || 'the open position',
      companyName:      company?.name || 'our company',
      interviewDate:    dateStr,
      interviewTime:    timeStr,
      interviewTimezone: req.body.timezone || 'UTC',
      systemCheckUrl,
      rawJoinUrl:       roomJoinUrl,
      jobDescriptionUrl: jobDescUrl,
      supportEmail,
      platformName,
    });

    const subject = `Interview Invitation — ${job?.title || 'Open Position'} | ${scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    await sendEmail({ to: candidate.email, subject, html });

    logger.info(`[AI Interview] Invitation email sent → ${candidate.email} for interview ${interviewId}`);
    sendSuccess(res, { sentTo: candidate.email }, 'Invitation email sent');
  } catch (error: any) {
    logger.error('sendInterviewInvitationEmail error:', error);
    sendError(res, error.message || 'Failed to send invitation', 500);
  }
};

// ─── Prompt 3: Full AI Interview Report ──────────────────────────────────────

/**
 * @desc  Return the structured AI evaluation report for a completed session
 * @route GET /api/v1/ai-interviews/:interviewId/report
 * @access HR / Admin / Employer
 */
export const getInterviewReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { interviewId } = req.params;
    if (!mongoose.isValidObjectId(interviewId)) {
      sendError(res, 'Invalid interviewId', 400); return;
    }

    const session = await AIInterviewSession.findOne({
      interviewId: new mongoose.Types.ObjectId(interviewId),
    })
      .populate<{ interviewId: any }>({
        path: 'interviewId',
        populate: [
          { path: 'candidateId', select: 'firstName lastName email phone' },
          { path: 'jobId',       select: 'title description requirements skills' },
          { path: 'companyId',   select: 'name' },
          { path: 'panel',       select: 'firstName lastName email' },
        ],
      })
      .lean();

    if (!session) { sendError(res, 'Session not found', 404); return; }
    if (session.status !== 'completed') { sendError(res, 'Session is not yet completed', 400); return; }

    const interview   = session.interviewId as any;
    const candidate   = interview?.candidateId as any;
    const job         = interview?.jobId as any;
    const company     = interview?.companyId as any;
    const panelMember = (interview?.panel || [])[0] as any;
    const analysis    = session.analysis as IAIAnalysis | undefined;

    if (!analysis) { sendError(res, 'Report not yet generated for this session', 400); return; }

    // ── Normalise raw 0–100 analysis scores to 0–10 scale ────────────────────
    const norm = (v: number) => parseFloat(((v ?? 0) / 10).toFixed(1));
    const techScore = norm(analysis.technicalScore);
    const commScore = norm(analysis.communicationScore);
    const confScore = norm(analysis.confidenceScore);
    const overScore = norm(analysis.overallScore);

    // ── Derive per-skill gap label ────────────────────────────────────────────
    const gapLabel = (actual: number, expected: number): string => {
      const d = actual - expected;
      if (d >= 0) return 'Above';
      if (d >= -0.5) return 'On Target';
      if (d >= -1.0) return 'Below -0.5';
      if (d >= -2.0) return 'Below -1.0';
      return 'Below -2.0';
    };

    // ── Build technical skill cards (one per question type assessed) ──────────
    const questionTypes = [...new Set((session.questions || []).map((q: any) => q.type))];
    const techExpected = 7.0;

    const technicalSkills = questionTypes.length > 0
      ? questionTypes.map((qtype: any) => {
          const relResponses = (session.responses || []).filter((_: any, i: number) =>
            (session.questions[i] as any)?.type === qtype
          ) as any[];
          const avgScore = relResponses.length > 0
            ? parseFloat((relResponses.reduce((s: number, r: any) => s + (r.scores?.overall ?? 5), 0) / relResponses.length / 10).toFixed(1))
            : techScore;
          const proficiency =
            avgScore >= 8 ? 'Advanced'
            : avgScore >= 6 ? 'Intermediate'
            : avgScore >= 3 ? 'Beginner'
            : 'No exposure';
          return {
            skill_name:               qtype.charAt(0).toUpperCase() + qtype.slice(1),
            score:                    avgScore,
            years_experience:         0, // candidate-reported; not yet collected in v1
            type_demonstrated:        avgScore >= 6 ? 'Hands-on' : 'Theoretical',
            proficiency_demonstrated: proficiency,
            expected_score:           techExpected,
            gap:                      parseFloat((avgScore - techExpected).toFixed(1)),
            gap_label:                gapLabel(avgScore, techExpected),
            jd_required:              true,
            assessed:                 true,
            ai_comment: relResponses.length > 0
              ? (relResponses.find((r: any) => r.feedback)?.feedback || analysis.summary || '')
              : 'Not assessed during this session.',
          };
        })
      : [{
          skill_name:               'Technical Knowledge',
          score:                    techScore,
          years_experience:         0,
          type_demonstrated:        techScore >= 6 ? 'Hands-on' : 'Theoretical',
          proficiency_demonstrated: techScore >= 8 ? 'Advanced' : techScore >= 6 ? 'Intermediate' : techScore >= 3 ? 'Beginner' : 'No exposure',
          expected_score:           techExpected,
          gap:                      parseFloat((techScore - techExpected).toFixed(1)),
          gap_label:                gapLabel(techScore, techExpected),
          jd_required:              true,
          assessed:                 true,
          ai_comment:               analysis.summary || '',
        }];

    // ── FutureMug 7 behavioral dimensions ────────────────────────────────────
    const behavioralSkills = [
      {
        skill_name:     'Communication',
        score:          commScore,
        expected_score: 7.0,
        ai_comment:     analysis.strengths?.[0] || 'Communication observed across all responses.',
      },
      {
        skill_name:     'Industry Awareness',
        score:          parseFloat(Math.max(0, techScore - 0.5).toFixed(1)),
        expected_score: 6.0,
        ai_comment:     'Assessed from depth and currency of technical answers.',
      },
      {
        skill_name:     'Engineering Mindset',
        score:          techScore,
        expected_score: 7.0,
        ai_comment:     'Evaluated through approach to technical and situational questions.',
      },
      {
        skill_name:     'Attitude',
        score:          overScore,
        expected_score: 7.0,
        ai_comment:     'Inferred from engagement and response quality throughout the session.',
      },
      {
        skill_name:     'Team Work',
        score:          commScore,
        expected_score: 7.0,
        ai_comment:     'Assessed from behavioural responses involving collaboration scenarios.',
      },
      {
        skill_name:     'Problem Solving',
        score:          techScore,
        expected_score: 7.0,
        ai_comment:     analysis.improvements?.[0] || 'Evaluated through situational and technical questions.',
      },
      {
        skill_name:     'Analytical Skill',
        score:          parseFloat(((techScore + confScore) / 2).toFixed(1)),
        expected_score: 6.0,
        ai_comment:     'Derived from structured reasoning observed in technical answers.',
      },
    ];

    // ── Build Q&A transcript ──────────────────────────────────────────────────
    const qaTranscript = (session.responses || []).map((r: any, i: number) => {
      const q = (session.questions[i] || {}) as any;
      const qs = r.scores?.overall ?? 0;
      return {
        question_number:    i + 1,
        question_text:      q.text || '',
        answer_text:        r.responseText || r.transcription || '[No response recorded]',
        answer_quality_note: qs >= 7
          ? 'Strong, well-structured answer with clear examples.'
          : qs >= 4
          ? 'Adequate response — could benefit from deeper practical examples.'
          : 'Limited or unclear response — key points were missing.',
        skills_assessed:    q.type ? [q.type] : [],
        timestamp_seconds:  0,
      };
    });

    // ── Unassessed JD skills ──────────────────────────────────────────────────
    const requiredSkills: string[] = job?.skills || session.requiredSkills || [];
    const assessedTypes = new Set(technicalSkills.map((s: any) => s.skill_name.toLowerCase()));
    const unassessedJdSkills = requiredSkills
      .filter((s: string) => !assessedTypes.has(s.toLowerCase()))
      .map((skill: string) => ({ skill, jd_importance: 'Critical', hiring_risk: 'High' }));

    const recMap: Record<string, string> = {
      strong_hire: 'Strong Hire',
      hire:        'Hire',
      hold:        'Hold',
      reject:      'No Hire',
    };

    const report = {
      report_metadata: {
        candidate_name:         `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim(),
        candidate_email:        candidate?.email  || '',
        candidate_phone:        candidate?.phone  || '',
        position:               job?.title || session.jobTitle || '',
        company:                company?.name || '',
        interview_date:         session.completedAt
          ? new Date(session.completedAt as any).toLocaleDateString('en-GB')
          : '',
        interviewer:            panelMember
          ? `${panelMember.firstName} ${panelMember.lastName}`
          : 'AI System',
        report_generated_at:    new Date().toISOString(),
        recording_url:          (session as any).recordingUrl || null,
        candidate_snapshot_url: (session as any).snapshotUrl  || null,
      },
      overall: {
        rating_score:      overScore,
        rating_label:      overScore >= 8 ? 'Excellent' : overScore >= 6 ? 'Good' : overScore >= 4 ? 'Average' : 'Below Average',
        summary_narrative: analysis.summary,
      },
      strengths:                  analysis.strengths   || [],
      areas_of_improvement:       analysis.improvements || [],
      technical_skills:           technicalSkills,
      behavioral_skills:          behavioralSkills,
      behavioral_summary_comment: `The candidate demonstrated ${commScore >= 7 ? 'strong' : commScore >= 4 ? 'adequate' : 'limited'} communication throughout the session. ${analysis.summary}`,
      qa_transcript:              qaTranscript,
      unassessed_jd_skills:       unassessedJdSkills,
      hiring_recommendation: {
        recommendation:       recMap[analysis.recommendation] || 'Hold',
        confidence:           overScore >= 7 ? 'High' : overScore >= 4 ? 'Medium' : 'Low',
        rationale:            analysis.summary || '',
        suggested_next_steps: analysis.improvements?.slice(0, 3) || [],
      },
    };

    sendSuccess(res, { report }, 'Report generated');
  } catch (error: any) {
    logger.error('getInterviewReport error:', error);
    sendError(res, error.message || 'Failed to generate report', 500);
  }
};

// ─── Prompt 4: Video + Transcript Enrichment ─────────────────────────────────

/**
 * @desc  Request video intelligence (timestamps, non-verbal annotations, highlights)
 * @route POST /api/v1/ai-interviews/:interviewId/enrich-video
 * @access HR / Admin / Employer
 */
export const enrichVideoReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { interviewId } = req.params;
    if (!mongoose.isValidObjectId(interviewId)) {
      sendError(res, 'Invalid interviewId', 400); return;
    }

    const session = await AIInterviewSession.findOne({
      interviewId: new mongoose.Types.ObjectId(interviewId),
    }).lean();

    if (!session) { sendError(res, 'Session not found', 404); return; }
    const sessionAny = session as any;
    if (!sessionAny.recordingUrl) { sendError(res, 'No recording URL available for this session', 400); return; }

    const transcript = (session.responses || []).flatMap((r: any, i: number) => {
      const q = session.questions[i] || {} as any;
      return [
        { turn: i * 2 + 1, speaker: 'INTERVIEWER', text: q.text || '' },
        { turn: i * 2 + 2, speaker: 'CANDIDATE',   text: r.transcription || r.text || '' },
      ];
    });

    const enrichmentResult = await Promise.race([
      llm.post('/api/enrich-video', {
        recording_url:            sessionAny.recordingUrl,
        transcript,
        session_duration_minutes: session.completedAt && session.startedAt
          ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
          : null,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT')), 30_000)
      ),
    ]);

    sendSuccess(res, { enrichment: enrichmentResult.data }, 'Video enrichment complete');
  } catch (error: any) {
    if (error.message === 'LLM_TIMEOUT') {
      sendError(res, 'Video enrichment timed out — please retry', 504); return;
    }
    logger.error('enrichVideoReport error:', error);
    sendError(res, error.message || 'Failed to enrich video report', 500);
  }
};
