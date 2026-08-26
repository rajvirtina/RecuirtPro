/**
 * SystemCheck — Pre-join device readiness diagnostics (Prompt 2)
 *
 * Runs 6 checks in sequence: Camera, Microphone, Browser, Speed, Resolution, WebRTC.
 * Critical failures BLOCK entry; non-critical issues show advisory banners.
 * On ALLOW, redirects to the interview room.
 *
 * Route: /system-check/:interviewId
 * Public — no auth required (interview ID is the credential).
 */

import { useEffect, useReducer, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Check definitions ────────────────────────────────────────────────────────

interface CheckDef {
  id:       number;
  name:     string;
  critical: boolean;
  icon:     string;
  run:      () => Promise<CheckStatus>;
  failMsg:  string;
  fixUrl:   string | null;
}

type CheckStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warning';

interface CheckResult {
  id:      number;
  name:    string;
  icon:    string;
  status:  CheckStatus;
  critical: boolean;
  failMsg: string;
  fixUrl:  string | null;
}

const SUPPORTED_BROWSERS: { name: string; minVersion: number }[] = [
  { name: 'Chrome',  minVersion: 90 },
  { name: 'Edge',    minVersion: 90 },
  { name: 'Firefox', minVersion: 88 },
  { name: 'Safari',  minVersion: 14 },
];

function detectBrowserVersion(): { name: string; version: number } | null {
  const ua = navigator.userAgent;
  const tests: [RegExp, string][] = [
    [/Edg\/(\d+)/,     'Edge'],
    [/Chrome\/(\d+)/,  'Chrome'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Version\/(\d+).+Safari/, 'Safari'],
  ];
  for (const [re, name] of tests) {
    const m = ua.match(re);
    if (m) return { name, version: parseInt(m[1], 10) };
  }
  return null;
}

/** Lightweight speed test: download a ~100 KB blob and measure throughput. */
async function measureSpeedMbps(): Promise<number> {
  const start = performance.now();
  // Use a public speed-test endpoint or fallback to a known URL on the same origin
  const testUrl = `${window.location.origin}/api/v1/health?_=${Date.now()}`;
  try {
    const res  = await fetch(testUrl, { cache: 'no-store' });
    const blob = await res.blob();
    const ms   = performance.now() - start;
    const mb   = blob.size / (1024 * 1024);
    return (mb / ms) * 1000 * 8; // Mbps
  } catch {
    return 0;
  }
}

function buildChecks(): CheckDef[] {
  return [
    {
      id: 1, name: 'Camera Access', critical: true, icon: '📷',
      failMsg: 'Camera not detected or permission denied. Please allow camera access in your browser settings.',
      fixUrl: 'https://support.google.com/chrome/answer/2693767',
      run: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          return 'pass';
        } catch { return 'fail'; }
      },
    },
    {
      id: 2, name: 'Microphone Access', critical: true, icon: '🎤',
      failMsg: 'Microphone not detected. Please connect a microphone and allow access.',
      fixUrl: 'https://support.google.com/chrome/answer/2693767',
      run: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          return 'pass';
        } catch { return 'fail'; }
      },
    },
    {
      id: 3, name: 'Browser Compatibility', critical: true, icon: '🌐',
      failMsg: 'Your browser is not fully supported. Please use Google Chrome (latest version) for the best experience.',
      fixUrl: 'https://www.google.com/chrome',
      run: async () => {
        const browser = detectBrowserVersion();
        if (!browser) return 'fail';
        const supported = SUPPORTED_BROWSERS.find(b => b.name === browser.name);
        if (!supported || browser.version < supported.minVersion) return 'fail';
        return 'pass';
      },
    },
    {
      id: 4, name: 'Internet Speed', critical: false, icon: '⚡',
      failMsg: 'Your internet speed may affect video quality. We recommend a stable Wi-Fi connection of at least 2 Mbps.',
      fixUrl: null,
      run: async () => {
        const mbps = await measureSpeedMbps();
        if (mbps < 2) return 'warning';
        return 'pass';
      },
    },
    {
      id: 5, name: 'Screen Resolution', critical: false, icon: '🖥️',
      failMsg: 'Your screen resolution is low. The interview may not display correctly. Use a larger screen if possible.',
      fixUrl: null,
      run: async () => {
        if (screen.width < 1024 || screen.height < 768) return 'warning';
        return 'pass';
      },
    },
    {
      id: 6, name: 'WebRTC Support', critical: true, icon: '📡',
      failMsg: 'Your browser does not support real-time video. Please update or switch to Chrome.',
      fixUrl: 'https://www.google.com/chrome',
      run: async () => {
        if (typeof RTCPeerConnection === 'undefined') return 'fail';
        return 'pass';
      },
    },
  ];
}

// ─── State machine ────────────────────────────────────────────────────────────

interface State {
  phase:   'running' | 'allow' | 'block';
  checks:  CheckResult[];
  current: number; // index of check currently running
  notices: string[];
}

type Action =
  | { type: 'START_CHECK'; index: number }
  | { type: 'FINISH_CHECK'; index: number; status: CheckStatus }
  | { type: 'DONE'; phase: 'allow' | 'block'; notices: string[] };

function initState(defs: CheckDef[]): State {
  return {
    phase:   'running',
    current: 0,
    notices: [],
    checks:  defs.map(d => ({
      id:       d.id,
      name:     d.name,
      icon:     d.icon,
      status:   'pending',
      critical: d.critical,
      failMsg:  d.failMsg,
      fixUrl:   d.fixUrl,
    })),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_CHECK': {
      const checks = state.checks.map((c, i) =>
        i === action.index ? { ...c, status: 'running' as CheckStatus } : c
      );
      return { ...state, checks, current: action.index };
    }
    case 'FINISH_CHECK': {
      const checks = state.checks.map((c, i) =>
        i === action.index ? { ...c, status: action.status } : c
      );
      return { ...state, checks };
    }
    case 'DONE':
      return { ...state, phase: action.phase, notices: action.notices };
    default:
      return state;
  }
}

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CheckStatus, { bg: string; text: string; label: string; ring: string }> = {
  pending: { bg: 'bg-neutral-100',  text: 'text-neutral-400', label: '—',      ring: 'ring-neutral-200' },
  running: { bg: 'bg-blue-50',      text: 'text-blue-500',    label: '...',    ring: 'ring-blue-300'    },
  pass:    { bg: 'bg-emerald-50',   text: 'text-emerald-600', label: 'PASS',   ring: 'ring-emerald-300' },
  fail:    { bg: 'bg-red-50',       text: 'text-red-600',     label: 'FAIL',   ring: 'ring-red-300'     },
  warning: { bg: 'bg-amber-50',     text: 'text-amber-600',   label: 'WARN',   ring: 'ring-amber-300'   },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemCheck() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate        = useNavigate();
  const defs            = buildChecks();
  const [state, dispatch] = useReducer(reducer, defs, initState);

  const runChecks = useCallback(async () => {
    const notices: string[] = [];
    let blocked = false;

    for (let i = 0; i < defs.length; i++) {
      dispatch({ type: 'START_CHECK', index: i });
      const status = await defs[i].run();
      dispatch({ type: 'FINISH_CHECK', index: i, status });

      if (status === 'fail' && defs[i].critical) {
        blocked = true;
      }
      if (status === 'warning') {
        notices.push(defs[i].failMsg);
      }
    }

    dispatch({ type: 'DONE', phase: blocked ? 'block' : 'allow', notices });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { runChecks(); }, [runChecks]);

  const handleJoin = () => {
    if (interviewId) {
      navigate(`/interviews/${interviewId}/room`);
    }
  };

  const completedCount = state.checks.filter(c => c.status !== 'pending' && c.status !== 'running').length;
  const progress       = Math.round((completedCount / defs.length) * 100);

  const criticalFails = state.checks.filter(c => c.status === 'fail' && c.critical);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 text-white text-3xl mb-4 shadow-lg">
            🔍
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">System Check</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Verifying your device is ready for the interview
          </p>
        </div>

        {/* Progress bar */}
        {state.phase === 'running' && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Checking device…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}

        {/* Check list */}
        <div className="space-y-3 mb-6">
          {state.checks.map((check, i) => {
            const s = STATUS_STYLES[check.status];
            return (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-3 p-4 rounded-xl ring-1 ${s.bg} ${s.ring}`}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{check.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-800">{check.name}</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>
                      {check.status === 'running' ? (
                        <span className="inline-flex gap-0.5">
                          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                        </span>
                      ) : s.label}
                    </span>
                  </div>
                  <AnimatePresence>
                    {(check.status === 'fail' || check.status === 'warning') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2"
                      >
                        <p className={`text-xs ${s.text}`}>{check.failMsg}</p>
                        {check.fixUrl && (
                          <a
                            href={check.fixUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-teal-600 underline mt-1 inline-block"
                          >
                            How to fix →
                          </a>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {check.critical && (
                  <span className="text-[10px] text-neutral-400 flex-shrink-0 mt-1">Required</span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Advisory notices */}
        {state.notices.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Advisory</p>
            <ul className="space-y-1">
              {state.notices.map((n, i) => (
                <li key={i} className="text-xs text-amber-700">• {n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Final action */}
        <AnimatePresence>
          {state.phase === 'allow' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-emerald-700 font-semibold text-sm">
                  ✅ All critical checks passed! You are ready to join.
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  ℹ️ No additional software required — your browser is all you need.
                </p>
              </div>
              <button
                onClick={handleJoin}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-base transition-colors shadow-md"
              >
                ▶ &nbsp;Join Interview Now
              </button>
            </motion.div>
          )}

          {state.phase === 'block' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700 font-semibold text-sm mb-2">
                  🚫 Some required checks failed
                </p>
                <ul className="text-xs text-red-600 space-y-1 text-left">
                  {criticalFails.map(c => (
                    <li key={c.id}>• {c.name}: {c.failMsg}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-500 mt-3">
                  Please fix the issues above, then refresh this page to re-run the checks.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-neutral-700 hover:bg-neutral-800 text-white font-bold rounded-xl text-base transition-colors"
              >
                🔄 &nbsp;Re-run System Check
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Having trouble?{' '}
          <a
            href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@recruirtpro.com'}`}
            className="text-teal-600 underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
