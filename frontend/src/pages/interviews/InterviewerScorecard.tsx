import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScorecardData {
  jobTitle: string;
  candidateName: string;
  interviewType?: string;
  interviewerName?: string;
}

type Recommendation = 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';

interface Scores {
  technicalSkills: number;
  communication: number;
  problemSolving: number;
  culturalFit: number;
  leadership: number;
}

type PageState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

// ─── Star Rating Component ────────────────────────────────────────────────────

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-neutral-700 min-w-[140px]">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={`${label} rating`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <svg
              className={`w-6 h-6 ${
                star <= (hover || value) ? 'text-amber-400' : 'text-neutral-200'
              } transition-colors`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 text-xs text-neutral-400 w-4">{value || '-'}</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewerScorecard() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const feedbackToken = searchParams.get('token');

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<ScorecardData | null>(null);
  const [error, setError] = useState('');

  const [scores, setScores] = useState<Scores>({
    technicalSkills: 0,
    communication: 0,
    problemSolving: 0,
    culturalFit: 0,
    leadership: 0,
  });
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = feedbackToken
          ? `${apiBase}/interviews/${id}/feedback-info?token=${encodeURIComponent(feedbackToken)}`
          : `${apiBase}/interviews/${id}/feedback-info`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const storedToken = localStorage.getItem('token');
        if (storedToken && !feedbackToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Unable to load interview details');
        }
        const json = await res.json();
        setData(json.data || json);
        setState('form');
      } catch (e: any) {
        setError(e.message || 'Failed to load scorecard');
        setState('error');
      }
    };
    if (id) fetchData();
  }, [id, feedbackToken, apiBase]);

  const updateScore = (key: keyof Scores, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = scores.technicalSkills > 0 && scores.communication > 0 &&
    scores.problemSolving > 0 && scores.culturalFit > 0 && recommendation;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setState('submitting');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedToken = localStorage.getItem('token');
      if (storedToken && !feedbackToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const url = feedbackToken
        ? `${apiBase}/interviews/${id}/feedback?token=${encodeURIComponent(feedbackToken)}`
        : `${apiBase}/interviews/${id}/feedback`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scores, recommendation, strengths, concerns }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit feedback');
      }
      setState('success');
    } catch (e: any) {
      setError(e.message);
      setState('form');
    }
  };

  // ─── Loading ────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading scorecard...</div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-error-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Unable to Load Scorecard</h2>
          <p className="text-sm text-neutral-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Success ────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Feedback Submitted</h2>
          <p className="text-sm text-neutral-500 mt-2">Thank you for your evaluation. The hiring team has been notified.</p>
        </div>
      </div>
    );
  }

  // ─── Form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
              {data?.candidateName?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">{data?.candidateName}</h1>
              <p className="text-sm text-neutral-500">{data?.jobTitle}{data?.interviewType ? ` · ${data.interviewType.replace('_', ' ')}` : ''}</p>
            </div>
          </div>
          {data?.interviewerName && (
            <p className="text-xs text-neutral-400 mt-2">Evaluator: {data.interviewerName}</p>
          )}
        </div>

        {/* Competency Scores */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">Competency Assessment</h2>
          <div className="divide-y divide-neutral-100">
            <StarRating label="Technical Skills" value={scores.technicalSkills} onChange={(v) => updateScore('technicalSkills', v)} />
            <StarRating label="Communication" value={scores.communication} onChange={(v) => updateScore('communication', v)} />
            <StarRating label="Problem Solving" value={scores.problemSolving} onChange={(v) => updateScore('problemSolving', v)} />
            <StarRating label="Cultural Fit" value={scores.culturalFit} onChange={(v) => updateScore('culturalFit', v)} />
            <StarRating label="Leadership (optional)" value={scores.leadership} onChange={(v) => updateScore('leadership', v)} />
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">Overall Recommendation</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { value: 'strong_hire', label: 'Strong Hire', color: 'border-success-500 bg-success-50 text-success-700' },
              { value: 'hire', label: 'Hire', color: 'border-primary-500 bg-primary-50 text-primary-700' },
              { value: 'no_hire', label: 'No Hire', color: 'border-warning-500 bg-warning-50 text-warning-700' },
              { value: 'strong_no_hire', label: 'Strong No Hire', color: 'border-error-500 bg-error-50 text-error-700' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecommendation(opt.value)}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg border-2 transition-all ${
                  recommendation === opt.value ? opt.color : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Written Feedback */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Strengths</label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-h-[80px] resize-y"
              placeholder="What stood out positively about this candidate?"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Concerns</label>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-h-[80px] resize-y"
              placeholder="Any areas of concern or gaps?"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          {error && <p className="text-sm text-error-600 mb-3">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || state === 'submitting'}
            className="w-full px-4 py-3 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
          </button>
          {!canSubmit && (
            <p className="text-xs text-neutral-400 text-center mt-2">
              Rate at least Technical Skills, Communication, Problem Solving, Cultural Fit, and select a recommendation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
