import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';

export interface TranscriptItem {
  questionNumber:      number;
  question:            string;
  questionType:        string;
  response:            string;
  scores: {
    technicalAccuracy:    number;
    communicationClarity: number;
    confidence:           number;
    overall:              number;
  };
  feedback:            string;
  improvementTip:      string;
  passed:              boolean;
  responseTimeSeconds: number;
}

interface TranscriptViewerProps {
  transcript: TranscriptItem[];
  candidateName?: string;
  jobTitle?: string;
  interviewDate?: string;
}

type Tab = 'full' | 'questions' | 'responses';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_VARIANT: Record<string, 'blue' | 'purple' | 'yellow' | 'green'> = {
  technical:   'blue',
  behavioral:  'purple',
  situational: 'yellow',
  hr:          'green',
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 8 ? 'text-success-700 bg-success-50' :
    value >= 6 ? 'text-warning-700 bg-warning-50' :
    'text-error-700 bg-error-50';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <span className="sr-only">{label}:</span>
      {label} {value}/10
    </span>
  );
}

function TranscriptCard({ item }: { item: TranscriptItem }) {
  const [expanded, setExpanded] = useState(false);
  const typeVariant = TYPE_VARIANT[item.questionType] ?? 'gray';

  return (
    <article
      className={`rounded-xl border transition-colors ${
        item.passed ? 'border-neutral-200' : 'border-error-200 bg-error-50/30'
      }`}
    >
      {/* Question header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 flex items-start gap-3"
        aria-expanded={expanded}
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
          {item.questionNumber}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={typeVariant} className="text-xs capitalize">{item.questionType}</Badge>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              item.passed ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
            }`}>
              <span className="sr-only">Result:</span>
              {item.passed ? '✓ Passed' : '✗ Did not pass'}
            </span>
            <span className="text-xs text-neutral-400 ml-auto">{fmtTime(item.responseTimeSeconds)}</span>
          </div>
          <p className="text-sm font-medium text-neutral-900 line-clamp-2 text-left">{item.question}</p>
        </div>
        <svg
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-neutral-100">
          {/* Question */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Question</p>
            <p className="text-sm text-neutral-800 leading-relaxed">{item.question}</p>
          </div>

          {/* Response */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Candidate Response</p>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap bg-neutral-50 rounded-lg p-3 border border-neutral-100">
              {item.response || <em className="text-neutral-400">No response recorded</em>}
            </p>
          </div>

          {/* Scores */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">AI Scores</p>
            <div className="flex flex-wrap gap-2">
              <ScorePill label="Technical"      value={item.scores.technicalAccuracy} />
              <ScorePill label="Communication"  value={item.scores.communicationClarity} />
              <ScorePill label="Confidence"     value={item.scores.confidence} />
              <ScorePill label="Overall"        value={item.scores.overall} />
            </div>
          </div>

          {/* AI Feedback */}
          {item.feedback && (
            <div className="flex gap-3 p-3 rounded-lg bg-info-50 border border-info-100">
              <svg className="w-4 h-4 text-info-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-info-800 space-y-1">
                <p>{item.feedback}</p>
                {item.improvementTip && (
                  <p className="text-info-600"><span className="font-semibold">Tip:</span> {item.improvementTip}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TranscriptViewer({ transcript, candidateName, jobTitle, interviewDate }: TranscriptViewerProps) {
  const [activeTab, setActiveTab]   = useState<Tab>('full');
  const [search, setSearch]         = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return transcript;
    const q = search.toLowerCase();
    return transcript.filter(
      t => t.question.toLowerCase().includes(q) || t.response.toLowerCase().includes(q)
    );
  }, [transcript, search]);

  const handlePDFExport = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = transcript.map(t => `
      <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:700;color:#111827">Q${t.questionNumber} — ${t.questionType}</span>
          <span style="font-size:12px;color:${t.passed ? '#059669' : '#dc2626'}">${t.passed ? '✓ Passed' : '✗ Did not pass'} · Overall ${t.scores.overall}/10</span>
        </div>
        <p style="font-weight:600;color:#374151;margin-bottom:8px">${t.question}</p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin-bottom:8px">${t.response || '(no response)'}</p>
        ${t.feedback ? `<p style="font-size:12px;color:#2563eb;background:#eff6ff;padding:8px;border-radius:4px">💡 ${t.feedback}</p>` : ''}
      </div>
    `).join('');

    win.document.write(`
      <html>
        <head>
          <title>Interview Transcript — ${candidateName || 'Candidate'}</title>
          <style>
            body { font-family: -apple-system, sans-serif; padding: 40px; max-width: 820px; margin: 0 auto; color: #111827; }
            h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .meta { font-size: 13px; color: #6b7280; margin-bottom: 32px; }
          </style>
        </head>
        <body>
          <h1>Interview Transcript</h1>
          <p class="meta">
            ${candidateName ? `Candidate: ${candidateName}` : ''}
            ${jobTitle ? ` · Role: ${jobTitle}` : ''}
            ${interviewDate ? ` · Date: ${interviewDate}` : ''}
          </p>
          ${rows}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'full',      label: 'Full Transcript'    },
    { key: 'questions', label: 'AI Questions'       },
    { key: 'responses', label: 'Candidate Responses'},
  ];

  return (
    <section className="card" aria-labelledby="transcript-heading">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 flex flex-wrap items-center justify-between gap-3">
        <h2 id="transcript-heading" className="text-h3 text-neutral-900">Interview Transcript</h2>
        <button
          onClick={handlePDFExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-100 px-6 mt-4" role="tablist">
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions or responses…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
          />
        </div>
        {search && (
          <p className="mt-1.5 text-xs text-neutral-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
          </p>
        )}
      </div>

      {/* Content */}
      <div className="px-6 pb-6" role="tabpanel">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-500 py-8 text-center">
            {search ? `No results for "${search}"` : 'No transcript available'}
          </p>
        ) : (
          <div className="space-y-3">
            {activeTab === 'full' && filtered.map(item => (
              <TranscriptCard key={item.questionNumber} item={item} />
            ))}

            {activeTab === 'questions' && (
              <ol className="space-y-3">
                {filtered.map(item => (
                  <li key={item.questionNumber} className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                      {item.questionNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={TYPE_VARIANT[item.questionType] ?? 'gray'} className="text-xs capitalize">
                          {item.questionType}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-800 leading-relaxed">{item.question}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {activeTab === 'responses' && filtered.map(item => (
              <div key={item.questionNumber} className={`p-4 rounded-xl border ${item.passed ? 'border-neutral-200' : 'border-error-200 bg-error-50/30'}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-neutral-400">Q{item.questionNumber}</span>
                  <Badge variant={TYPE_VARIANT[item.questionType] ?? 'gray'} className="text-xs capitalize">{item.questionType}</Badge>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    item.passed ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
                  }`}>
                    {item.passed ? '✓ Passed' : '✗ Did not pass'}
                  </span>
                  <span className="ml-auto text-xs font-bold text-neutral-700">
                    <span className="sr-only">Overall score: </span>
                    {item.scores.overall}/10
                  </span>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {item.response || <em className="text-neutral-400">No response recorded</em>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
