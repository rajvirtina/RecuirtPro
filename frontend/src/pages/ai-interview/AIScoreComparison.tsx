import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateScore {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  interviewDate: string;
  recommendation: 'strong_hire' | 'hire' | 'hold' | 'reject';
  scores: {
    communication: number;
    technical: number;
    confidence: number;
    problemSolving: number;
    culturalFit: number;
    overall: number;
  };
  strengths: string[];
  improvements: string[];
  questionsAnswered: number;
  questionsPassed: number;
}

const REC_META: Record<string, { label: string; color: string; bg: string }> = {
  strong_hire: { label: 'Strong Hire', color: 'text-success-700', bg: 'bg-success-50' },
  hire:        { label: 'Hire',        color: 'text-success-600', bg: 'bg-success-50' },
  hold:        { label: 'On Hold',     color: 'text-warning-700', bg: 'bg-warning-50' },
  reject:      { label: 'Reject',      color: 'text-error-700',   bg: 'bg-error-50'   },
};

const DIMENSIONS = ['communication', 'technical', 'confidence', 'problemSolving', 'culturalFit'] as const;
const DIM_LABELS: Record<string, string> = {
  communication: 'Communication',
  technical: 'Technical',
  confidence: 'Confidence',
  problemSolving: 'Problem Solving',
  culturalFit: 'Cultural Fit',
};

// ─── Score bar with comparison ────────────────────────────────────────────────

function CompareBar({ label, scores, maxScore }: { label: string; scores: { name: string; value: number; color: string }[]; maxScore: number }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{label}</p>
      {scores.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 w-20 truncate">{s.name.split(' ')[0]}</span>
          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${s.color}`}
              style={{ width: `${Math.min(100, (s.value / maxScore) * 100)}%` }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-neutral-700 w-8 text-right">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIScoreComparison() {
  const [searchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const [candidates, setCandidates] = useState<CandidateScore[]>([]);
  const [allCandidates, setAllCandidates] = useState<CandidateScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState('');
  const [sortBy, setSortBy] = useState<'overall' | 'technical' | 'communication' | 'confidence'>('overall');

  const jobId = searchParams.get('jobId');

  useEffect(() => {
    fetchCandidates();
  }, [jobId]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const url = jobId
        ? `/applications?jobId=${jobId}&hasAiReport=true&limit=50`
        : `/applications?hasAiReport=true&limit=50`;
      const res = await apiClient.get(url);
      const apps = (res.data as any)?.data || (res.data as any) || [];

      const scored: CandidateScore[] = apps
        .filter((a: any) => a.aiReport || a.overallScore)
        .map((a: any) => ({
          applicationId: a._id,
          candidateName: a.candidateId
            ? `${a.candidateId.firstName || ''} ${a.candidateId.lastName || ''}`.trim()
            : 'Candidate',
          candidateEmail: a.candidateId?.email || '',
          jobTitle: a.jobId?.title || a.job?.title || '',
          interviewDate: a.aiReport?.interviewDate || a.createdAt || '',
          recommendation: a.aiReport?.recommendation || (a.overallScore >= 70 ? 'hire' : a.overallScore >= 50 ? 'hold' : 'reject'),
          scores: {
            communication: a.aiReport?.scores?.communication || a.skillMatchScore || 0,
            technical: a.aiReport?.scores?.technical || a.experienceMatchScore || 0,
            confidence: a.aiReport?.scores?.confidence || 0,
            problemSolving: a.aiReport?.scores?.problemSolving || 0,
            culturalFit: a.aiReport?.scores?.culturalFit || 0,
            overall: a.aiReport?.scores?.overall || a.overallScore || 0,
          },
          strengths: a.aiReport?.strengths || a.matchingSkills || [],
          improvements: a.aiReport?.improvements || a.missingSkills || [],
          questionsAnswered: a.aiReport?.questionsAnswered || 0,
          questionsPassed: a.aiReport?.questionsPassed || 0,
        }));

      setAllCandidates(scored);
      setCandidates(scored);
    } catch (err) {
      console.error('Failed to fetch AI scores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter & sort
  useEffect(() => {
    let filtered = [...allCandidates];
    if (jobFilter) filtered = filtered.filter(c => c.jobTitle.toLowerCase().includes(jobFilter.toLowerCase()));
    filtered.sort((a, b) => b.scores[sortBy] - a.scores[sortBy]);
    setCandidates(filtered);
  }, [allCandidates, jobFilter, sortBy]);

  const colors = ['bg-primary-500', 'bg-info-500', 'bg-success-500', 'bg-warning-500', 'bg-purple-500', 'bg-pink-500'];

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">AI Score Comparison</h1>
          <p className="text-sm text-neutral-500 mt-1">Compare AI interview scores across candidates side-by-side</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter by job title…"
            value={jobFilter}
            onChange={e => setJobFilter(e.target.value)}
            className="field-input w-48 text-sm"
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="field-input w-40 text-sm">
            <option value="overall">Sort: Overall</option>
            <option value="technical">Sort: Technical</option>
            <option value="communication">Sort: Communication</option>
            <option value="confidence">Sort: Confidence</option>
          </select>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-neutral-500">No AI-interviewed candidates found.</p>
          <p className="text-sm text-neutral-400 mt-1">Schedule AI interviews to see comparison data here.</p>
        </div>
      ) : (
        <>
          {/* Candidate cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidates.slice(0, 9).map((c, idx) => {
              const rec = REC_META[c.recommendation] || REC_META.hold;
              return (
                <div key={c.applicationId} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar name={c.candidateName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{c.candidateName}</p>
                      <p className="text-xs text-neutral-500 truncate">{c.jobTitle}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rec.bg} ${rec.color}`}>
                      {c.scores.overall}%
                    </span>
                  </div>

                  {/* Mini score bars */}
                  <div className="space-y-2 mb-3">
                    {DIMENSIONS.map(dim => (
                      <div key={dim} className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 w-16 truncate">{DIM_LABELS[dim]}</span>
                        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[idx % colors.length]}`}
                            style={{ width: `${c.scores[dim]}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 w-6 text-right">{c.scores[dim]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recommendation + link */}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                    <Badge variant={c.recommendation === 'strong_hire' || c.recommendation === 'hire' ? 'green' : c.recommendation === 'hold' ? 'yellow' : 'red'}>
                      {rec.label}
                    </Badge>
                    <Link to={`/applications/${c.applicationId}/ai-report`}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      View Report →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side-by-side dimension comparison */}
          {candidates.length >= 2 && (
            <section className="card card-md">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">
                Dimension Comparison <span className="text-sm font-normal text-neutral-400">(top {Math.min(5, candidates.length)} candidates)</span>
              </h2>
              <div className="space-y-6">
                {DIMENSIONS.map(dim => (
                  <CompareBar
                    key={dim}
                    label={DIM_LABELS[dim]}
                    maxScore={100}
                    scores={candidates.slice(0, 5).map((c, i) => ({
                      name: c.candidateName,
                      value: c.scores[dim],
                      color: colors[i % colors.length],
                    }))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Ranking table */}
          <section className="card overflow-hidden">
            <h2 className="text-lg font-bold text-neutral-900 p-5 pb-3">AI Interview Rankings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs text-neutral-400 uppercase tracking-wider">
                    <th className="text-left px-5 py-2">#</th>
                    <th className="text-left px-5 py-2">Candidate</th>
                    <th className="text-left px-5 py-2">Job</th>
                    <th className="text-center px-3 py-2">Overall</th>
                    <th className="text-center px-3 py-2">Tech</th>
                    <th className="text-center px-3 py-2">Comm</th>
                    <th className="text-center px-3 py-2">Conf</th>
                    <th className="text-center px-3 py-2">Recommendation</th>
                    <th className="text-right px-5 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {candidates.map((c, i) => {
                    const rec = REC_META[c.recommendation] || REC_META.hold;
                    return (
                      <tr key={c.applicationId} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 text-neutral-400 font-medium">{i + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={c.candidateName} size="xs" />
                            <span className="font-medium text-neutral-800 truncate max-w-[140px]">{c.candidateName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-neutral-500 truncate max-w-[120px]">{c.jobTitle}</td>
                        <td className="px-3 py-3 text-center font-bold text-neutral-900">{c.scores.overall}</td>
                        <td className="px-3 py-3 text-center text-neutral-600">{c.scores.technical}</td>
                        <td className="px-3 py-3 text-center text-neutral-600">{c.scores.communication}</td>
                        <td className="px-3 py-3 text-center text-neutral-600">{c.scores.confidence}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rec.bg} ${rec.color}`}>
                            {rec.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link to={`/applications/${c.applicationId}/ai-report`}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                            Report
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
