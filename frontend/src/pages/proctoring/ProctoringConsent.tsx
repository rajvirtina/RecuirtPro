/**
 * ProctoringConsent — shown before any AI interview starts.
 *
 * When VITE_ENABLE_PROCTORING is not "true" the component calls onAccept
 * immediately without rendering the consent form (proctoring is disabled).
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const PROCTORING_ENABLED = import.meta.env.VITE_ENABLE_PROCTORING === 'true';
const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5001/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** 64-char hex session token from the AI interview URL */
  sessionId: string;
  /** Called when the candidate accepts all consents */
  onAccept: () => void;
  /** Called when the candidate declines */
  onDecline: () => void;
}

// ─── Consent items ────────────────────────────────────────────────────────────

const CONSENT_ITEMS = [
  {
    id:    'webcam',
    label: 'I consent to webcam monitoring during this interview',
    icon:  '📹',
  },
  {
    id:    'audio',
    label: 'I consent to audio monitoring during this interview',
    icon:  '🎤',
  },
  {
    id:    'tab',
    label: 'I understand that tab switching and window focus loss will be logged',
    icon:  '🖥️',
  },
  {
    id:    'storage',
    label: 'I agree that a recording of this session may be stored for up to 30 days',
    icon:  '🔒',
  },
];

// ─── Decline explanation ──────────────────────────────────────────────────────

function DeclineMessage({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center space-y-5 py-8">
      <div className="w-14 h-14 rounded-full bg-error-50 border border-error-200 flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-neutral-900">Interview cannot proceed</h2>
      <p className="text-neutral-600 leading-relaxed">
        Proctoring consent is required to ensure a fair and secure interview process.
        Without consent, the AI interview session cannot be started.
      </p>
      <p className="text-sm text-neutral-500 leading-relaxed">
        If you have concerns about how your data is used, please contact the recruiter
        who sent you this link before proceeding.
      </p>
      <button
        onClick={onGoBack}
        className="text-primary-600 hover:text-primary-700 font-medium text-sm underline"
      >
        ← Go back and review consents
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProctoringConsent({ sessionId, onAccept, onDecline }: Props) {
  const [checked, setChecked]   = useState<Record<string, boolean>>({});
  const [declined, setDeclined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  // If proctoring is disabled skip the consent screen entirely
  useEffect(() => {
    if (!PROCTORING_ENABLED) {
      onAccept();
    }
  }, []);

  if (!PROCTORING_ENABLED) return null;

  const allChecked = CONSENT_ITEMS.every(item => checked[item.id]);

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAccept = async () => {
    if (!allChecked) return;
    setSubmitting(true);
    setError('');
    try {
      await axios.post(
        `${API_BASE}/proctoring/session/${sessionId}/consent`,
        {
          consented:  true,
          timestamp:  new Date().toISOString(),
          userAgent:  navigator.userAgent,
        }
      );
      onAccept();
    } catch (err: any) {
      // Don't block the interview if the consent API fails — just log and proceed
      console.warn('[Proctoring] Consent POST failed:', err.message);
      onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    try {
      await axios.post(
        `${API_BASE}/proctoring/session/${sessionId}/consent`,
        {
          consented:  false,
          timestamp:  new Date().toISOString(),
          userAgent:  navigator.userAgent,
        }
      );
    } catch { /* best-effort */ }
    setDeclined(true);
    onDecline();
  };

  if (declined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <DeclineMessage onGoBack={() => setDeclined(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-lg w-full space-y-6">

        {/* Icon + title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-900/40 border border-indigo-700 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Before we begin</h1>
          <p className="text-gray-400 text-sm">Interview monitoring &amp; recording</p>
        </div>

        {/* Explanation card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-gray-300 leading-relaxed">
            To ensure a fair and secure interview, this session will be monitored
            using your webcam and microphone. The following activities will be tracked:
          </p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            {[
              'Webcam feed — face presence and count',
              'Audio environment — background noise detection',
              'Tab focus — switching away from this window',
              'Clipboard — copy/paste attempts',
            ].map(item => (
              <li key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Consent checkboxes */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Please read and check each item individually
          </p>

          {CONSENT_ITEMS.map(item => (
            <label
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                checked[item.id]
                  ? 'border-indigo-600 bg-indigo-900/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={!!checked[item.id]}
                onChange={() => toggle(item.id)}
                className="mt-0.5 w-4 h-4 rounded accent-indigo-500 shrink-0 cursor-pointer"
                aria-label={item.label}
              />
              <span className="text-sm text-gray-200 leading-snug">
                <span className="mr-1.5" aria-hidden="true">{item.icon}</span>
                {item.label}
              </span>
            </label>
          ))}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={!allChecked || submitting}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
              allChecked && !submitting
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming…
              </span>
            ) : (
              'I Agree and Start Interview'
            )}
          </button>

          {!allChecked && (
            <p className="text-center text-xs text-gray-500">
              Please check all {CONSENT_ITEMS.length} items above to continue
            </p>
          )}

          <div className="text-center">
            <button
              onClick={handleDecline}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              I Decline — I do not wish to proceed
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 leading-relaxed">
          Your data is handled in accordance with our Privacy Policy.
          Recording will be automatically deleted after 30 days.
        </p>
      </div>
    </div>
  );
}
