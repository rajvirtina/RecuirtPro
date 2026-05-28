/**
 * AIInterviewRoom — candidate-facing AI interview interface
 *
 * Full-screen, distraction-free, no sidebar/nav.
 * State machine driven by useReducer.
 *
 * Phases:
 *   initialising → consent → briefing → question → submitting
 *   → evaluating → question (loop) → completed
 *   Error / disconnected overlays can fire at any point.
 *
 * Transport: REST via /api/v1/ai-interviews/session/:sessionId/*
 * (The backend REST routes handle the full AI interview lifecycle.)
 */

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

import QuestionCard, { Question } from './components/QuestionCard';
import VoiceRecorder             from './components/VoiceRecorder';
import TextResponse              from './components/TextResponse';
import ProctoringMonitor         from '../proctoring/ProctoringMonitor';
import ProctoringConsent         from '../proctoring/ProctoringConsent';

// ─── API client ───────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:5001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionInfo {
  sessionId: string;
  jobTitle: string;
  companyName: string;
  interviewRound: string;
  difficulty: string;
  totalQuestions: number;
  status: string;
  expiresAt: string;
  proctoringEnabled: boolean;
  consentGiven: boolean;
  currentQuestionIndex: number;
  responsesCount: number;
}

interface Scores {
  technical_accuracy:    number;
  communication_clarity: number;
  confidence:            number;
  overall:               number;
}

interface Analysis {
  overallScore:       number;
  technicalScore:     number;
  communicationScore: number;
  confidenceScore:    number;
  questionsAnswered:  number;
  questionsPassed:    number;
  recommendation:     string;
  strengths:          string[];
  improvements:       string[];
  summary:            string;
}

// ─── State machine ────────────────────────────────────────────────────────────

type Phase =
  | 'initialising'
  | 'consent'
  | 'briefing'
  | 'question'
  | 'submitting'
  | 'evaluating'
  | 'completed'
  | 'error'
  | 'disconnected';

interface RoomState {
  phase:           Phase;
  session:         SessionInfo | null;
  currentQuestion: Question | null;
  questionNumber:  number;
  totalQuestions:  number;
  analysis:        Analysis | null;
  lastScores:      Scores | null;
  lastFeedback:    string;
  errorMsg:        string;
  retryCount:      number;
}

type RoomAction =
  | { type: 'SESSION_LOADED';  session: SessionInfo }
  | { type: 'ALREADY_DONE';    session: SessionInfo; analysis?: Analysis }
  | { type: 'BEGIN_BRIEFING' }
  | { type: 'INTERVIEW_STARTED'; question: Question; questionNumber: number; totalQuestions: number }
  | { type: 'SUBMITTING' }
  | { type: 'EVALUATING' }
  | { type: 'NEXT_QUESTION';   question: Question; questionNumber: number; scores: Scores; feedback: string }
  | { type: 'COMPLETED';       analysis: Analysis; scores: Scores; feedback: string }
  | { type: 'ERROR';           message: string }
  | { type: 'RETRY' }
  | { type: 'DISCONNECTED' }
  | { type: 'RECONNECTED' };

const initialState: RoomState = {
  phase:           'initialising',
  session:         null,
  currentQuestion: null,
  questionNumber:  1,
  totalQuestions:  0,
  analysis:        null,
  lastScores:      null,
  lastFeedback:    '',
  errorMsg:        '',
  retryCount:      0,
};

function reducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SESSION_LOADED':
      return { ...state, phase: 'consent', session: action.session, totalQuestions: action.session.totalQuestions };

    case 'ALREADY_DONE':
      return { ...state, phase: 'completed', session: action.session, analysis: action.analysis ?? null };

    case 'BEGIN_BRIEFING':
      return { ...state, phase: 'briefing' };

    case 'INTERVIEW_STARTED':
      return {
        ...state,
        phase:           'question',
        currentQuestion: action.question,
        questionNumber:  action.questionNumber,
        totalQuestions:  action.totalQuestions,
        lastScores:      null,
        lastFeedback:    '',
      };

    case 'SUBMITTING':
      return { ...state, phase: 'submitting' };

    case 'EVALUATING':
      return { ...state, phase: 'evaluating' };

    case 'NEXT_QUESTION':
      return {
        ...state,
        phase:           'question',
        currentQuestion: action.question,
        questionNumber:  action.questionNumber,
        lastScores:      action.scores,
        lastFeedback:    action.feedback,
      };

    case 'COMPLETED':
      return {
        ...state,
        phase:       'completed',
        analysis:    action.analysis,
        lastScores:  action.scores,
        lastFeedback: action.feedback,
      };

    case 'ERROR':
      return { ...state, phase: 'error', errorMsg: action.message };

    case 'RETRY':
      return { ...initialState, retryCount: state.retryCount + 1 };

    case 'DISCONNECTED':
      return { ...state, phase: 'disconnected' };

    case 'RECONNECTED':
      // Restore to question if we were mid-interview
      return {
        ...state,
        phase: state.currentQuestion ? 'question' : 'consent',
      };

    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats seconds as HH:MM:SS */
function fmtHMS(s: number) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss].map(v => String(v).padStart(2, '0')).join(':');
}

/** Exponential-backoff retry */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, baseMs * 2 ** i));
      }
    }
  }
  throw lastErr;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionDot({ live }: { live: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${live ? 'bg-success-400' : 'bg-error-400 animate-pulse'}`} />
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct   = Math.round((value / 10) * 100);
  const color = pct >= 70 ? 'bg-success-500' : pct >= 50 ? 'bg-warning-400' : 'bg-error-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span className="font-semibold text-neutral-700">{value}/10</span>
      </div>
      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DotsProgress({ current, total }: { current: number; total: number }) {
  // Clamp dot count for mobile — show max 12
  const count = Math.min(total, 12);
  const scale = total > 12 ? total / 12 : 1;

  return (
    <div className="flex items-center gap-1.5" aria-label={`Question ${current} of ${total}`}>
      {Array.from({ length: count }).map((_, i) => {
        const idx    = Math.round(i * scale);          // mapped question index
        const done   = idx < current - 1;
        const active = idx === current - 1;
        return (
          <span
            key={i}
            className={[
              'block rounded-full transition-all duration-300',
              done   ? 'w-2 h-2 bg-primary-600'                          : '',
              active ? 'w-3 h-3 bg-primary-500 ring-2 ring-primary-200'  : '',
              !done && !active ? 'w-2 h-2 bg-neutral-300'                : '',
            ].join(' ')}
          />
        );
      })}
      <span className="ml-2 text-xs font-medium text-neutral-500 whitespace-nowrap">
        {current} / {total}
      </span>
    </div>
  );
}

function RecommendationBadge({ rec }: { rec: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    strong_hire: { label: 'Strong Hire',  cls: 'bg-success-50 text-success-700 border-success-200'  },
    hire:        { label: 'Hire',         cls: 'bg-success-50 text-success-600 border-success-200'  },
    hold:        { label: 'On Hold',      cls: 'bg-warning-50 text-warning-700 border-warning-200'  },
    reject:      { label: 'Not Selected', cls: 'bg-error-50   text-error-700   border-error-200'    },
  };
  const m = map[rec] ?? { label: rec, cls: 'bg-neutral-100 text-neutral-700 border-neutral-300' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIInterviewRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Timer state ─────────────────────────────────────────────────────────────
  const [elapsedSec, setElapsedSec]     = useState(0);
  const [questionSec, setQuestionSec]   = useState(0);
  const elapsedIntervalRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionIntervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef                = useRef(Date.now());

  // ── Response state ───────────────────────────────────────────────────────────
  const [responseText, setResponseText] = useState('');
  const [audioBase64, setAudioBase64]   = useState('');
  const [voiceMode, setVoiceMode]       = useState(false);

  // ── Speech API support ───────────────────────────────────────────────────────
  // Initialise optimistically (true) to avoid a flash before the detection effect
  // runs.  The effect corrects this on unsupported browsers (Firefox, older Safari).
  const [speechSupported, setSpeechSupported] = useState(true);

  // ── Briefing countdown ───────────────────────────────────────────────────────
  const [briefingCount, setBriefingCount]       = useState(10);
  const pendingStartRef = useRef<{ question: Question; questionNumber: number; totalQuestions: number } | null>(null);
  const briefingApiDoneRef = useRef(false);
  const briefingTimerDoneRef = useRef(false);

  // ── Flag issue dialog ────────────────────────────────────────────────────────
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason]         = useState('');
  const [flagging, setFlagging]             = useState(false);

  // ── Connection / retry ───────────────────────────────────────────────────────
  const [connected, setConnected]       = useState(true);
  const reconnectAttemptsRef            = useRef(0);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  // Load session on mount / retry
  useEffect(() => {
    if (!sessionId) {
      dispatch({ type: 'ERROR', message: 'Missing session ID in URL.' });
      return;
    }
    loadSession();
  }, [sessionId, state.retryCount]);

  // Elapsed timer — starts when interview begins
  const startElapsedTimer = useCallback(() => {
    if (elapsedIntervalRef.current) return;
    elapsedIntervalRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
  }, []);

  // Question timer — resets when question changes
  const resetQuestionTimer = useCallback(() => {
    if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);
    questionStartRef.current = Date.now();
    setQuestionSec(0);
    questionIntervalRef.current = setInterval(() => setQuestionSec(s => s + 1), 1000);
  }, []);

  useEffect(() => {
    if (state.phase === 'question') resetQuestionTimer();
  }, [state.currentQuestion]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (elapsedIntervalRef.current)  clearInterval(elapsedIntervalRef.current);
    if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);
  }, []);

  // Briefing countdown
  useEffect(() => {
    if (state.phase !== 'briefing') return;

    briefingApiDoneRef.current   = false;
    briefingTimerDoneRef.current = false;
    pendingStartRef.current      = null;
    setBriefingCount(10);

    const tick = setInterval(() => {
      setBriefingCount(c => {
        if (c <= 1) {
          clearInterval(tick);
          briefingTimerDoneRef.current = true;
          tryTransitionFromBriefing();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [state.phase]);

  // Speech API detection — runs once on mount.
  // Web Speech API is available in Chrome / Edge but not in Firefox or Safari < 14.7.
  // When absent we auto-switch to text mode and show a one-time info toast.
  useEffect(() => {
    const supported = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
    setSpeechSupported(supported);
    if (!supported) {
      setVoiceMode(false);
      // Delay 1 s so the toast doesn't flash immediately on page load in
      // unsupported browsers before the UI has had a chance to settle.
      const timer = setTimeout(() => {
        toast.info('Switched to text mode', {
          description: 'Voice input requires Google Chrome or Microsoft Edge. Text mode is fully supported.',
          duration: 7000,
          icon: '⌨️',
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  // ─── API calls ───────────────────────────────────────────────────────────────

  const loadSession = async () => {
    try {
      const res = await withRetry(() => api.get(`/ai-interviews/session/${sessionId}`));
      const s: SessionInfo = res.data?.data ?? res.data;
      setConnected(true);
      reconnectAttemptsRef.current = 0;

      if (s.status === 'completed') {
        // Already done — show results
        dispatch({ type: 'ALREADY_DONE', session: s });
        fireCelebration();
        return;
      }

      if (s.status === 'in_progress' && s.consentGiven && s.responsesCount > 0) {
        // Resume mid-interview
        dispatch({ type: 'SESSION_LOADED', session: s });
        resumeSession(s);
        return;
      }

      dispatch({ type: 'SESSION_LOADED', session: s });
    } catch (err: any) {
      setConnected(false);
      const msg = err.response?.data?.message || 'Unable to load session. Check your link.';
      dispatch({ type: 'ERROR', message: msg });
    }
  };

  const resumeSession = async (s: SessionInfo) => {
    try {
      const res = await withRetry(() =>
        api.post(`/ai-interviews/session/${sessionId}/start`, { consentGiven: true })
      );
      const d = res.data?.data ?? res.data;
      if (d.question) {
        dispatch({
          type:           'INTERVIEW_STARTED',
          question:       d.question,
          questionNumber: d.questionNumber ?? (s.currentQuestionIndex + 1),
          totalQuestions: d.totalQuestions ?? s.totalQuestions,
        });
        startElapsedTimer();
      } else {
        dispatch({ type: 'SESSION_LOADED', session: s }); // fallback to consent
      }
    } catch {
      dispatch({ type: 'SESSION_LOADED', session: s });
    }
  };

  /** Called by the consent screen "I Agree" button */
  const handleConsent = async () => {
    dispatch({ type: 'BEGIN_BRIEFING' });

    try {
      const res = await withRetry(() =>
        api.post(`/ai-interviews/session/${sessionId}/start`, { consentGiven: true })
      );
      const d = res.data?.data ?? res.data;
      pendingStartRef.current = {
        question:       d.question,
        questionNumber: d.questionNumber ?? 1,
        totalQuestions: d.totalQuestions ?? (state.session?.totalQuestions ?? 7),
      };
      briefingApiDoneRef.current = true;
      tryTransitionFromBriefing();
    } catch (err: any) {
      dispatch({ type: 'ERROR', message: err.response?.data?.message || 'Failed to start interview.' });
    }
  };

  /** Fires when BOTH briefing countdown AND API call are complete */
  function tryTransitionFromBriefing() {
    if (briefingApiDoneRef.current && briefingTimerDoneRef.current && pendingStartRef.current) {
      const { question, questionNumber, totalQuestions } = pendingStartRef.current;
      dispatch({ type: 'INTERVIEW_STARTED', question, questionNumber, totalQuestions });
      startElapsedTimer();
    }
  }

  /** Submit current answer */
  const handleSubmitAnswer = async () => {
    if (!responseText.trim() || !state.currentQuestion) return;

    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    dispatch({ type: 'SUBMITTING' });

    try {
      const res = await withRetry(() =>
        api.post(`/ai-interviews/session/${sessionId}/answer`, {
          questionId:          state.currentQuestion!.id,
          responseText:        responseText.trim(),
          responseTimeSeconds: elapsed,
          ...(audioBase64 ? { audioBase64 } : {}),
        })
      );

      const d = res.data?.data ?? res.data;
      // Successful submit — reset reconnect counter and mark live
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      dispatch({ type: 'EVALUATING' });

      const scores: Scores = {
        technical_accuracy:    d.score?.technical_accuracy    ?? 5,
        communication_clarity: d.score?.communication_clarity ?? 5,
        confidence:            d.score?.confidence            ?? 5,
        overall:               d.score?.overall               ?? 5,
      };
      const feedback = d.feedback ?? '';

      // Brief evaluating pause (feels more "AI" — 2 s minimum)
      await new Promise(r => setTimeout(r, 2000));

      if (d.isComplete) {
        dispatch({ type: 'COMPLETED', analysis: d.analysis, scores, feedback });
        fireCelebration();
      } else {
        dispatch({ type: 'NEXT_QUESTION', question: d.nextQuestion, questionNumber: d.questionNumber, scores, feedback });
        setResponseText('');
        setAudioBase64('');
      }
    } catch (err: any) {
      reconnectAttemptsRef.current += 1;
      setConnected(false);
      if (reconnectAttemptsRef.current >= 3) {
        // Three consecutive failures → show the hard disconnected overlay
        dispatch({ type: 'DISCONNECTED' });
      } else {
        toast.error(
          `Submission failed (attempt ${reconnectAttemptsRef.current}/3). Please try again.`,
          { duration: 5000 }
        );
        // Return to question so the candidate can retry without losing their answer
        dispatch({
          type: 'INTERVIEW_STARTED',
          question:       state.currentQuestion!,
          questionNumber: state.questionNumber,
          totalQuestions: state.totalQuestions,
        });
      }
    }
  };

  const handleNeedMoreTime = () => {
    setResponseText('');
    setAudioBase64('');
    resetQuestionTimer();
  };

  /** Opens the flag dialog — does NOT terminate the session */
  const handleFlagIssue = () => {
    setFlagReason('');
    setShowFlagDialog(true);
  };

  /** POSTs to /flag (log-only endpoint) without touching session status */
  const handleSubmitFlag = async () => {
    const reason = flagReason.trim();
    if (!reason) return;
    setFlagging(true);
    try {
      await api.post(`/ai-interviews/session/${sessionId}/flag`, { reason });
      toast.info('Issue reported — a recruiter will follow up with you.');
    } catch {
      toast.error('Could not submit report. Please contact support directly.');
    } finally {
      setFlagging(false);
      setShowFlagDialog(false);
      setFlagReason('');
    }
  };

  function fireCelebration() {
    confetti({ particleCount: 130, spread: 80, origin: { y: 0.55 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.45 }, angle: 120 }), 400);
  }

  // ─── Connection watchdog ─────────────────────────────────────────────────────
  // If a submitting/evaluating call fails, we show an overlay.
  // The state machine handles the disconnect via ERROR → show reconnect overlay.

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const { phase, session, currentQuestion, questionNumber, totalQuestions, analysis, lastScores, lastFeedback, errorMsg } = state;
  const progressPct = totalQuestions > 0 ? Math.round(((questionNumber - 1) / totalQuestions) * 100) : 0;

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — INITIALISING
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'initialising') return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-5">
      {/* Skeleton top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-neutral-100 animate-pulse" />

      <div className="flex flex-col items-center gap-4 mt-14">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-500 font-medium">Connecting to AI Interviewer…</p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — ERROR
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'error') return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
        <div className="w-14 h-14 bg-error-50 border border-error-200 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Something went wrong</h2>
          <p className="mt-1.5 text-sm text-neutral-500 leading-relaxed">{errorMsg}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => dispatch({ type: 'RETRY' })}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Try Again
          </button>
          <a
            href="mailto:support@recruitpro.com"
            className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            Contact recruiter
          </a>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — CONSENT
  // ════════════════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — CONSENT
  //  If proctoring is enabled (VITE_ENABLE_PROCTORING=true) → show full
  //  ProctoringConsent form with 4 individual checkboxes.
  //  If proctoring is disabled → ProctoringConsent calls onAccept immediately
  //  and we fall through to the existing overview screen.
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'consent') {
    // When VITE_ENABLE_PROCTORING is "true" and session has proctoring enabled,
    // render the full-screen ProctoringConsent before the interview overview.
    const proctoringEnabled =
      import.meta.env.VITE_ENABLE_PROCTORING === 'true' &&
      session?.proctoringEnabled;

    if (proctoringEnabled) {
      return (
        <ProctoringConsent
          sessionId={sessionId!}
          onAccept={handleConsent}
          onDecline={() =>
            dispatch({ type: 'ERROR', message: 'Proctoring consent is required to proceed with this AI interview.' })
          }
        />
      );
    }

    // Default: show interview overview + single-click consent (no proctoring)
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        {/* Minimal top bar */}
        <header className="h-14 bg-white border-b border-neutral-100 flex items-center px-6 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 font-bold text-sm">
              {(session?.companyName ?? 'C')[0].toUpperCase()}
            </span>
          </div>
          <span className="font-semibold text-neutral-800 truncate">{session?.jobTitle}</span>
          <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
            <ConnectionDot live={connected} />
            {connected ? 'Ready' : 'Connecting…'}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
          <div className="max-w-lg w-full space-y-5">

            {/* Overview card */}
            <div className="bg-white rounded-2xl shadow-lg p-7 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900">{session?.jobTitle}</h1>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {session?.companyName} · {session?.interviewRound} Round
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-neutral-100 pt-5">
                {[
                  { value: String(session?.totalQuestions ?? '–'), label: 'Questions' },
                  { value: session?.difficulty ? session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1) : '–', label: 'Level' },
                  { value: `~${Math.ceil((session?.totalQuestions ?? 7) * 2.5)}`, label: 'Minutes' },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-2xl font-bold text-primary-600">{value}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 space-y-3">
              <h3 className="font-semibold text-neutral-800 text-sm">Before you begin</h3>
              <ul className="space-y-2.5">
                {[
                  'Find a quiet space with good lighting and minimal background noise',
                  'Ensure your microphone is working (or use text mode)',
                  'Speak clearly at a moderate pace — take your time on each answer',
                  'You can switch between voice and text mode at any time',
                  'Once started, keep the interview window active',
                ].map(tip => (
                  <li key={tip} className="flex items-start gap-2.5 text-sm text-neutral-600">
                    <svg className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleConsent}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl font-semibold text-base transition-colors shadow-lg"
            >
              I Agree — Begin Interview
            </button>
            <p className="text-center text-xs text-neutral-400">
              By clicking Begin, you consent to this session being recorded and AI-evaluated.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — BRIEFING (10-second countdown)
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'briefing') return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 gap-8">
      <div className="max-w-sm w-full space-y-7 text-center">

        {/* Role overview */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-primary-500 mb-2">
            {session?.companyName} · {session?.interviewRound}
          </p>
          <h2 className="text-2xl font-bold text-neutral-900">{session?.jobTitle}</h2>
        </div>

        {/* Countdown ring */}
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" strokeWidth="8" stroke="#e5e7eb" />
              <circle
                cx="56" cy="56" r="48" fill="none" strokeWidth="8"
                stroke="#6366f1"
                strokeDasharray={`${(briefingCount / 10) * 301.6} 301.6`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.9s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-neutral-900">{briefingCount}</span>
              <span className="text-xs text-neutral-400">seconds</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-neutral-800">Your interview will begin shortly</p>
          <p className="text-sm text-neutral-500">
            {totalQuestions} questions · {session?.difficulty} level · Preparing your question set…
          </p>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — COMPLETED
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'completed') return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="h-14 bg-white border-b border-neutral-100 flex items-center justify-center px-6 shrink-0">
        <p className="text-sm font-semibold text-neutral-700">
          {session?.companyName} — {session?.jobTitle}
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10 overflow-y-auto">
        <div className="max-w-lg w-full space-y-5">

          {/* Thank-you */}
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-success-50 border border-success-200 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-9 h-9 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Interview Complete!</h2>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto">
              Thank you for completing your AI interview for <strong className="text-neutral-700">{session?.jobTitle}</strong> at{' '}
              <strong className="text-neutral-700">{session?.companyName}</strong>.
              The recruitment team will review your session and be in touch soon.
            </p>
            <p className="text-xs text-neutral-400">Check your email for next steps.</p>
          </div>

          {/* Score summary */}
          {analysis && (
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-800">Your Session Summary</h3>
                <RecommendationBadge rec={analysis.recommendation} />
              </div>

              {/* Overall ring */}
              <div className="flex items-center gap-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" stroke="#e5e7eb" />
                    <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8"
                      stroke="#6366f1"
                      strokeDasharray={`${(analysis.overallScore / 100) * 201.1} 201.1`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-primary-600">
                    {analysis.overallScore}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-neutral-800">{analysis.summary}</p>
                  <p className="text-neutral-500">
                    {analysis.questionsAnswered} answered · {analysis.questionsPassed} passed
                  </p>
                </div>
              </div>

              {/* Score bars */}
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <ScoreBar label="Technical"     value={Math.round(analysis.technicalScore     / 10)} />
                <ScoreBar label="Communication" value={Math.round(analysis.communicationScore / 10)} />
                <ScoreBar label="Confidence"    value={Math.round(analysis.confidenceScore    / 10)} />
              </div>

              {/* Strengths */}
              {analysis.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-success-700">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to improve */}
              {analysis.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Areas to Improve</p>
                  <ul className="space-y-1.5">
                    {analysis.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-warning-700">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-neutral-400 pb-4">
            You can safely close this window. Your results have been sent to the recruitment team.
          </p>
        </div>
      </main>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — SUBMITTING / EVALUATING
  // ════════════════════════════════════════════════════════════════════════════

  if (phase === 'submitting' || phase === 'evaluating') return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 gap-6">

      {phase === 'evaluating' && lastScores ? (
        /* Show per-question scores while loading next question */
        <div className="max-w-sm w-full space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary-50 border border-primary-200 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <p className="font-semibold text-neutral-800">Response evaluated</p>
            {lastFeedback && (
              <p className="text-sm text-neutral-500 italic">"{lastFeedback}"</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
            <ScoreBar label="Technical Accuracy"    value={lastScores.technical_accuracy} />
            <ScoreBar label="Communication Clarity" value={lastScores.communication_clarity} />
            <ScoreBar label="Confidence"            value={lastScores.confidence} />
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            Loading next question…
          </div>
        </div>
      ) : (
        /* "Thinking" state — shown during submit (LLM call in flight) and
           during the Q1 evaluating pause (no previous scores to display yet). */
        <div className="text-center py-10 space-y-5">
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-primary-400 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-neutral-700">
              {phase === 'evaluating' ? 'Analysing your response…' : 'Submitting your answer…'}
            </p>
            <p className="text-sm text-neutral-400">
              {phase === 'evaluating'
                ? 'Our AI is carefully reviewing what you said'
                : 'Sending your response to the AI interviewer'}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER — QUESTION (primary interview state)
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <ProctoringMonitor sessionId={sessionId!} enabled={session?.proctoringEnabled ?? false}>
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {/* ─── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-neutral-100 flex items-center px-4 sm:px-6 z-20 shrink-0">

        {/* Left: company logo + job title */}
        <div className="flex items-center gap-2.5 min-w-0 w-1/4">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 font-bold text-sm">
              {(session?.companyName ?? 'C')[0].toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-semibold text-neutral-700 truncate hidden sm:block">
            {session?.jobTitle}
          </span>
        </div>

        {/* Centre: dot progress */}
        <div className="flex-1 flex items-center justify-center">
          <DotsProgress current={questionNumber} total={totalQuestions} />
        </div>

        {/* Right: elapsed timer + connection */}
        <div className="flex items-center gap-3 w-1/4 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded-full tabular-nums font-mono">
            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {fmtHMS(elapsedSec)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <ConnectionDot live={connected} />
            <span className="hidden sm:inline">{connected ? 'Live' : 'Reconnecting…'}</span>
          </div>
        </div>
      </header>

      {/* ─── Progress bar ─────────────────────────────────────────────────────── */}
      <div className="h-1 bg-neutral-100">
        <div
          className="h-1 bg-primary-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ─── Main content ────────────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >

        {/* Previous answer feedback toast (inline, non-blocking) */}
        {lastScores && lastFeedback && (
          <div className="max-w-2xl w-full bg-primary-50 border border-primary-100 rounded-xl px-5 py-3 flex items-start gap-3 text-sm">
            <svg className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-primary-700 italic">{lastFeedback}</span>
          </div>
        )}

        {/* Question card */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            elapsedQuestionSec={questionSec}
          />
        )}

        {/* Response area */}
        <div className="max-w-2xl w-full space-y-3">

          {/* Mode toggle — always shown.
               Voice button is disabled (greyed out + tooltip) on browsers that
               don't support the Web Speech API (Firefox, older Safari). */}
          <div className="flex items-center gap-2">
            {/* Voice */}
            <button
              onClick={() => speechSupported && setVoiceMode(true)}
              disabled={!speechSupported}
              title={!speechSupported ? 'Voice input requires Google Chrome or Microsoft Edge' : undefined}
              aria-disabled={!speechSupported}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                voiceMode && speechSupported
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300',
                !speechSupported ? 'opacity-40 cursor-not-allowed' : '',
              ].filter(Boolean).join(' ')}
            >
              🎙 Voice{!speechSupported && (
                <span className="text-xs ml-1 font-normal">(unavailable)</span>
              )}
            </button>

            {/* Text */}
            <button
              onClick={() => setVoiceMode(false)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                !voiceMode || !speechSupported
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300',
              ].join(' ')}
            >
              ⌨ Text
            </button>
          </div>

          {/* Input — voice or text */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            {voiceMode && speechSupported ? (
              <VoiceRecorder
                transcript={responseText}
                onTranscript={setResponseText}
                onAudioBase64={setAudioBase64}
                onPermissionDenied={() => {
                  toast.warning('Microphone access denied — switching to text mode');
                  setVoiceMode(false);
                }}
              />
            ) : (
              <div className="p-4">
                <TextResponse
                  value={responseText}
                  onChange={setResponseText}
                  placeholder="Type your answer here…"
                />
              </div>
            )}
          </div>

          {!responseText.trim() && (
            <p className="text-xs text-neutral-400 text-center">
              {voiceMode && speechSupported
                ? 'Your spoken words will appear above — then click Submit'
                : 'Minimum 10 characters required to submit'}
            </p>
          )}
        </div>
      </main>

      {/* ─── Bottom action bar ───────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-neutral-100 px-4 sm:px-6 py-4 shrink-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">

          {/* Submit */}
          <button
            onClick={handleSubmitAnswer}
            disabled={!responseText.trim() || responseText.trim().length < 10}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            Submit Answer →
          </button>

          {/* Need More Time */}
          <button
            onClick={handleNeedMoreTime}
            className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            title="Clear response and restart your answer"
          >
            Need More Time
          </button>

          {/* Report Issue */}
          <button
            onClick={handleFlagIssue}
            className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-400 hover:text-error-500 transition-colors"
            title="Report a technical issue"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
        </div>
      </footer>

      {/* ─── Flag / Report Issue dialog ──────────────────────────────────────── */}
      {showFlagDialog && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFlagDialog(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Report an Issue</h3>
              <button
                onClick={() => setShowFlagDialog(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-neutral-500">
              Describe the problem briefly. Your session will continue unaffected — a recruiter will follow up.
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value.slice(0, 500))}
              placeholder="e.g. Microphone is not responding, question loaded incorrectly…"
              rows={3}
              className="w-full border border-neutral-200 rounded-xl p-3 text-sm text-neutral-900 placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-400">{flagReason.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFlagDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFlag}
                  disabled={!flagReason.trim() || flagging}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {flagging ? 'Sending…' : 'Report Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Disconnected overlay ─────────────────────────────────────────────── */}
      {phase === 'disconnected' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5">
            <div className="w-14 h-14 bg-warning-50 border border-warning-200 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-warning-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-neutral-800">Connection lost</p>
              <p className="text-sm text-neutral-500 mt-1">
                {reconnectAttemptsRef.current} consecutive failure{reconnectAttemptsRef.current !== 1 ? 's' : ''} — click below to try again.
              </p>
            </div>
            <button
              onClick={() => {
                reconnectAttemptsRef.current = 0;
                setConnected(true);
                // If mid-interview, go back to the current question; otherwise restart
                if (state.currentQuestion) {
                  dispatch({ type: 'RECONNECTED' });
                } else {
                  dispatch({ type: 'RETRY' });
                }
              }}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Reconnect Now
            </button>
          </div>
        </div>
      )}
    </div>
    </ProctoringMonitor>
  );
}
