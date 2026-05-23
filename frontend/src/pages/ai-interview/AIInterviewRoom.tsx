import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';

// ─── Axios instance (no JWT interceptors — session token in URL) ──────────────
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api/v1',
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
}

interface Question {
  id: string;
  text: string;
  type: string;
  expectedDurationSeconds: number;
  orderIndex: number;
}

interface Scores {
  technical_accuracy: number;
  communication_clarity: number;
  confidence: number;
  overall: number;
}

interface Analysis {
  overallScore: number;
  recommendation: string;
  questionsAnswered: number;
  questionsPassed: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

type RoomState = 'loading' | 'error' | 'consent' | 'in_progress' | 'processing' | 'completed';

// ─── Web Speech API shim ──────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// ─── Retry helper (3 retries, exponential backoff) ────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 1000): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, baseMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('All retries exhausted');
}

// ─── Small icon components ────────────────────────────────────────────────────
function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}
    />
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-300">
        <span>{label}</span>
        <span className="font-semibold">{value}/10</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIInterviewRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // State machine
  const [roomState, setRoomState]     = useState<RoomState>('loading');
  const [errorMsg, setErrorMsg]       = useState('');

  // Session data
  const [session, setSession]         = useState<SessionInfo | null>(null);

  // Interview progress
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber]   = useState(1);
  const [totalQuestions, setTotalQuestions]   = useState(0);
  const [lastScores, setLastScores]           = useState<Scores | null>(null);
  const [lastFeedback, setLastFeedback]       = useState('');
  const [showFeedback, setShowFeedback]       = useState(false);
  const [analysis, setAnalysis]               = useState<Analysis | null>(null);

  // Response input
  const [responseText, setResponseText]       = useState('');
  const [voiceMode, setVoiceMode]             = useState(!!SpeechRecognitionAPI);
  const [isRecording, setIsRecording]         = useState(false);
  const [voiceSupported]                      = useState(!!SpeechRecognitionAPI);

  // Timers
  const [elapsedSec, setElapsedSec]           = useState(0);
  const [questionSec, setQuestionSec]         = useState(0);
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartTs = useRef<number>(Date.now());

  // Speech recognition
  const recognitionRef = useRef<any>(null);

  // Connection indicator
  const [connected, setConnected] = useState(true);

  // ─── Load session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { setErrorMsg('Missing session ID.'); setRoomState('error'); return; }
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setRoomState('loading');
    try {
      const res = await withRetry(() => api.get(`/ai-interviews/session/${sessionId}`));
      const s: SessionInfo = res.data?.data ?? res.data;
      setSession(s);
      if (s.status === 'completed') { setRoomState('completed'); confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } }); }
      else if (s.status === 'in_progress' && s.currentQuestionIndex > 0) {
        // Resume: re-fetch current question by restarting
        await resumeSession(s);
      } else {
        setRoomState('consent');
      }
      setTotalQuestions(s.totalQuestions);
      setConnected(true);
    } catch (err: any) {
      setConnected(false);
      setErrorMsg(err.response?.data?.message || 'Unable to load interview session. Please check your link.');
      setRoomState('error');
    }
  };

  const resumeSession = async (s: SessionInfo) => {
    try {
      const res = await api.post(`/ai-interviews/session/${sessionId}/start`, { consentGiven: true });
      const d = res.data?.data ?? res.data;
      if (d.question) {
        setCurrentQuestion(d.question);
        setQuestionNumber(d.questionNumber);
        setTotalQuestions(d.totalQuestions);
        startInterviewTimers();
        setRoomState('in_progress');
      }
    } catch {
      setRoomState('consent');
    }
  };

  // ─── Start timers ───────────────────────────────────────────────────────────
  const startInterviewTimers = useCallback(() => {
    if (elapsedRef.current)  clearInterval(elapsedRef.current);
    if (questionRef.current) clearInterval(questionRef.current);
    elapsedRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
  }, []);

  const resetQuestionTimer = useCallback(() => {
    questionStartTs.current = Date.now();
    if (questionRef.current) clearInterval(questionRef.current);
    setQuestionSec(0);
    questionRef.current = setInterval(() => setQuestionSec(s => s + 1), 1000);
  }, []);

  useEffect(() => () => {
    if (elapsedRef.current)  clearInterval(elapsedRef.current);
    if (questionRef.current) clearInterval(questionRef.current);
    stopRecording();
  }, []);

  // Reset question timer when question changes
  useEffect(() => {
    if (currentQuestion) resetQuestionTimer();
  }, [currentQuestion]);

  // ─── Voice recognition ──────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    let finalTranscript = responseText;

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setResponseText(finalTranscript + interim);
    };
    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') { setIsRecording(false); }
    };
    rec.onend = () => setIsRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [responseText]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  // ─── Consent → start interview ──────────────────────────────────────────────
  const handleStart = async () => {
    setRoomState('loading');
    try {
      const res = await withRetry(() =>
        api.post(`/ai-interviews/session/${sessionId}/start`, { consentGiven: true })
      );
      const d = res.data?.data ?? res.data;
      setCurrentQuestion(d.question);
      setQuestionNumber(d.questionNumber ?? 1);
      setTotalQuestions(d.totalQuestions);
      startInterviewTimers();
      setRoomState('in_progress');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to start interview. Please retry.');
      setRoomState('error');
    }
  };

  // ─── Submit answer ──────────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (!responseText.trim()) return;
    if (!currentQuestion) return;

    stopRecording();
    setRoomState('processing');
    setShowFeedback(false);

    const elapsed = Math.floor((Date.now() - questionStartTs.current) / 1000);

    try {
      const res = await withRetry(() =>
        api.post(`/ai-interviews/session/${sessionId}/answer`, {
          questionId:          currentQuestion.id,
          responseText:        responseText.trim(),
          responseTimeSeconds: elapsed,
        })
      );
      const d = res.data?.data ?? res.data;

      setLastScores(d.score);
      setLastFeedback(d.feedback || '');
      setShowFeedback(true);

      if (d.isComplete) {
        setAnalysis(d.analysis);
        setRoomState('completed');
        // Fire confetti celebration
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } else {
        // Brief feedback pause then show next question
        setTimeout(() => {
          setCurrentQuestion(d.nextQuestion);
          setQuestionNumber(d.questionNumber);
          setResponseText('');
          setShowFeedback(false);
          setRoomState('in_progress');
        }, 3500);
      }
    } catch (err: any) {
      setConnected(false);
      setErrorMsg(err.response?.data?.message || 'Failed to submit answer. Please retry.');
      setRoomState('in_progress'); // Allow retry
    }
  };

  // ─── Need more time ─────────────────────────────────────────────────────────
  const handleNeedMoreTime = () => {
    resetQuestionTimer();
    setResponseText('');
    if (isRecording) stopRecording();
  };

  // ─── Flag issue ─────────────────────────────────────────────────────────────
  const handleFlagIssue = () => {
    const issue = prompt('Briefly describe the issue you are experiencing:');
    if (issue) {
      // Best-effort log — non-blocking
      api.post(`/ai-interviews/session/${sessionId}/complete`, {}).catch(() => {});
      setErrorMsg(`Issue flagged: "${issue}". A recruiter will follow up with you.`);
      setRoomState('error');
    }
  };

  // ─── Format helpers ─────────────────────────────────────────────────────────
  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const recommendationMeta = (r: string) => {
    if (r === 'strong_hire') return { label: 'Strong Hire', color: 'text-green-400', bg: 'bg-green-900/40 border-green-700' };
    if (r === 'hire')        return { label: 'Hire',        color: 'text-green-300', bg: 'bg-green-900/30 border-green-800' };
    if (r === 'hold')        return { label: 'On Hold',     color: 'text-yellow-400',bg: 'bg-yellow-900/30 border-yellow-700' };
    return { label: 'Not Selected', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700' };
  };

  // ─── Render states ────────────────────────────────────────────────────────

  // LOADING
  if (roomState === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-300 text-lg">Connecting to AI Interviewer</p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ERROR
  if (roomState === 'error') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white px-4">
      <div className="max-w-md text-center space-y-5">
        <div className="w-14 h-14 bg-red-900/40 border border-red-700 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{errorMsg}</p>
        <button
          onClick={loadSession}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  // CONSENT SCREEN
  if (roomState === 'consent') return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div>
          <p className="text-xs text-indigo-400 uppercase tracking-wider font-semibold">{session?.companyName}</p>
          <h1 className="text-lg font-bold truncate">{session?.jobTitle}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Dot active={connected} />
          {connected ? 'Connected' : 'Reconnecting…'}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full space-y-8">
          {/* Interview overview card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-900/50 border border-indigo-700 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{session?.jobTitle}</h2>
              <p className="text-gray-400 mt-1">{session?.companyName} · {session?.interviewRound} Round</p>
            </div>
            <div className="flex justify-center gap-6 text-sm pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-300">{session?.totalQuestions}</p>
                <p className="text-gray-500 text-xs">Questions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-300 capitalize">{session?.difficulty}</p>
                <p className="text-gray-500 text-xs">Difficulty</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-300">~{Math.ceil((session?.totalQuestions ?? 7) * 2.5)}</p>
                <p className="text-gray-500 text-xs">Minutes</p>
              </div>
            </div>
          </div>

          {/* Consent + instructions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-200">Before you begin</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {[
                'Find a quiet place with good lighting',
                'Ensure your camera and microphone are working',
                'Speak clearly and at a moderate pace',
                'You may type your answers if voice is unavailable',
                'Each question has a recommended time — take your time',
              ].map(tip => (
                <li key={tip} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {tip}
                </li>
              ))}
            </ul>

            {session?.proctoringEnabled && (
              <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                This interview session is monitored. Ensure you are in a private space.
              </div>
            )}
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-indigo-900/30"
          >
            I Agree — Start Interview
          </button>
          <p className="text-center text-xs text-gray-600">
            By clicking Start, you consent to this session being recorded and evaluated.
          </p>
        </div>
      </main>
    </div>
  );

  // PROCESSING
  if (roomState === 'processing') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
      {showFeedback && lastScores ? (
        <div className="max-w-sm w-full mx-auto px-4 space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-900/40 border border-indigo-700 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <p className="text-gray-300 text-sm">Response evaluated</p>
            {lastFeedback && <p className="text-indigo-200 text-sm italic">"{lastFeedback}"</p>}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <ScoreBar label="Technical Accuracy"    value={lastScores.technical_accuracy} />
            <ScoreBar label="Communication Clarity" value={lastScores.communication_clarity} />
            <ScoreBar label="Confidence"            value={lastScores.confidence} />
          </div>
          <p className="text-center text-gray-500 text-sm">Loading next question…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300">AI is evaluating your response…</p>
        </div>
      )}
    </div>
  );

  // COMPLETED
  if (roomState === 'completed') return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white">
      <header className="px-6 py-4 bg-gray-900 border-b border-gray-800 text-center">
        <p className="text-xs text-indigo-400 uppercase tracking-wider font-semibold">{session?.companyName}</p>
        <h1 className="text-lg font-bold">{session?.jobTitle} — Interview Complete</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full space-y-6">
          {/* Thank-you card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Interview Complete</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Thank you for completing your AI interview for <strong className="text-white">{session?.jobTitle}</strong> at <strong className="text-white">{session?.companyName}</strong>.
              The recruitment team will review your session and be in touch soon.
            </p>
          </div>

          {/* Analysis card */}
          {analysis && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-200">Your Session Summary</h3>
                <div className={`px-3 py-1 border rounded-full text-xs font-bold ${recommendationMeta(analysis.recommendation).bg} ${recommendationMeta(analysis.recommendation).color}`}>
                  {recommendationMeta(analysis.recommendation).label}
                </div>
              </div>

              {/* Overall score ring */}
              <div className="flex items-center gap-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" className="stroke-gray-800" />
                    <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8"
                      className="stroke-indigo-500"
                      strokeDasharray={`${(analysis.overallScore / 100) * 201} 201`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-indigo-300">
                    {analysis.overallScore}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <p className="text-white font-medium">{analysis.summary}</p>
                  <p>{analysis.questionsAnswered} questions answered · {analysis.questionsPassed} passed</p>
                </div>
              </div>

              {/* Strengths */}
              {analysis.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Strengths</p>
                  <ul className="space-y-1">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-300">
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
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Areas to Improve</p>
                  <ul className="space-y-1">
                    {analysis.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-yellow-300">
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

          <p className="text-center text-xs text-gray-600">
            You can safely close this window. Results have been sent to the recruitment team.
          </p>
        </div>
      </main>
    </div>
  );

  // ─── IN PROGRESS ────────────────────────────────────────────────────────────
  const progressPct = totalQuestions > 0 ? Math.round(((questionNumber - 1) / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white select-none">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800 z-10">
        <div className="min-w-0">
          <p className="text-xs text-indigo-400 uppercase tracking-wider font-semibold truncate">{session?.companyName}</p>
          <h1 className="text-sm sm:text-base font-bold truncate">{session?.jobTitle}</h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Elapsed timer */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {fmtTime(elapsedSec)}
          </div>
          {/* Monitoring indicator */}
          {session?.proctoringEnabled && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
              <Dot active />
              <span>Monitoring active</span>
            </div>
          )}
          {/* Connection */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Dot active={connected} />
            <span className="hidden sm:inline">{connected ? 'Connected' : 'Reconnecting…'}</span>
          </div>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="w-full bg-gray-800 h-1">
        <div
          className="bg-indigo-500 h-1 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col px-4 sm:px-8 py-6 sm:py-8 max-w-3xl mx-auto w-full">

        {/* Question header */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-300 bg-indigo-900/30 border border-indigo-800 px-3 py-1 rounded-full uppercase tracking-wider">
            {currentQuestion?.type?.replace(/_/g, ' ')}
          </span>
          <span className="text-sm text-gray-400">
            Question <strong className="text-white">{questionNumber}</strong> of <strong className="text-white">{totalQuestions}</strong>
          </span>
        </div>

        {/* Question text */}
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
            <p className="text-xl sm:text-2xl font-medium leading-relaxed text-gray-100">
              {currentQuestion?.text}
            </p>
            {currentQuestion?.expectedDurationSeconds && (
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suggested: {Math.ceil(currentQuestion.expectedDurationSeconds / 60)} minutes
                {questionSec > 0 && (
                  <span className={`ml-2 ${questionSec > currentQuestion.expectedDurationSeconds * 1.5 ? 'text-yellow-500' : 'text-gray-600'}`}>
                    · {fmtTime(questionSec)} elapsed
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Response area */}
          <div className="space-y-3">
            {/* Voice/text toggle */}
            {voiceSupported && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setVoiceMode(true); setResponseText(''); stopRecording(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${voiceMode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  🎤 Voice
                </button>
                <button
                  onClick={() => { setVoiceMode(false); stopRecording(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!voiceMode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  ⌨️ Text
                </button>
              </div>
            )}

            {voiceMode && voiceSupported ? (
              /* Voice mode */
              <div className="space-y-3">
                <button
                  onClick={toggleRecording}
                  className={`w-full py-4 rounded-2xl border-2 font-semibold transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-900/30 border-red-600 text-red-300 animate-pulse'
                      : 'bg-gray-900 border-gray-700 hover:border-indigo-600 text-gray-300 hover:text-white'
                  }`}
                >
                  {isRecording ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                      Recording… tap to stop
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Tap to speak
                    </span>
                  )}
                </button>
                {responseText && (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 min-h-[80px] whitespace-pre-wrap leading-relaxed">
                    {responseText}
                  </div>
                )}
              </div>
            ) : (
              /* Text mode */
              <textarea
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                placeholder="Type your answer here…"
                rows={5}
                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl p-4 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            )}

            {!responseText.trim() && (
              <p className="text-xs text-gray-600 text-center">
                {voiceMode && voiceSupported ? 'Your spoken words will appear above' : 'Minimum 10 characters required'}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ── Bottom controls ── */}
      <footer className="bg-gray-900 border-t border-gray-800 px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Submit */}
          <button
            onClick={handleSubmitAnswer}
            disabled={!responseText.trim()}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors shadow-lg shadow-indigo-900/20"
          >
            Submit Answer →
          </button>

          {/* Need more time */}
          <button
            onClick={handleNeedMoreTime}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap"
            title="Clear and restart your answer"
          >
            Restart
          </button>

          {/* Flag issue */}
          <button
            onClick={handleFlagIssue}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-red-400 transition-colors"
            title="Flag a technical issue"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
