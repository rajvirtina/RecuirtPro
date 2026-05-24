import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import apiClient             from '../../services/api';
import { Avatar }            from '../../components/ui/Avatar';
import { Badge }             from '../../components/ui/Badge';
import { Button }            from '../../components/ui/Button';
import { StatCard }          from '../../components/ui/StatCard';
import { EmptyState }        from '../../components/ui/EmptyState';
import { Skeleton, SkeletonStat } from '../../components/ui/Skeleton';
import { ScoreRadar, RadarScores } from '../../components/charts/ScoreRadar';
import { ViolationTimeline, ViolationEvent } from '../../components/proctoring/ViolationTimeline';
import { TranscriptViewer, TranscriptItem }  from '../../components/interview/TranscriptViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

type Recommendation = 'strong_hire' | 'hire' | 'hold' | 'reject';

interface AIReport {
  applicationId:     string;
  applicationStatus: string;
  candidate: { id: string; name: string; email: string; profileImage?: string };
  job:        { id: string; title: string };
  interview:  { id: string; date: string; duration: number; round: string; aiModel: string };
  recommendation: Recommendation;
  scores: {
    communication:  number;
    technical:      number;
    confidence:     number;
    overall:        number;
    problemSolving: number;
    culturalFit:    number;
  };
  aiSummary:        string;
  strengths:        string[];
  improvements:     string[];
  transcript:       TranscriptItem[];
  proctoringEvents: ViolationEvent[];
  sessionStatus:    string;
  questionsAnswered: number;
  questionsPassed:   number;
}

// ─── Recommendation metadata ──────────────────────────────────────────────────

const REC_META: Record<Recommendation, {
  label: string; badgeVariant: 'green' | 'yellow' | 'red';
  headerBg: string; headerText: string; headerBorder: string;
}> = {
  strong_hire: { label: 'Strongly Recommended', badgeVariant: 'green',  headerBg: 'bg-success-50',  headerText: 'text-success-800', headerBorder: 'border-success-200' },
  hire:        { label: 'Recommended',           badgeVariant: 'green',  headerBg: 'bg-success-50',  headerText: 'text-success-800', headerBorder: 'border-success-200' },
  hold:        { label: 'Needs Review',           badgeVariant: 'yellow', headerBg: 'bg-warning-50',  headerText: 'text-warning-800', headerBorder: 'border-warning-200' },
  reject:      { label: 'Not Recommended',        badgeVariant: 'red',    headerBg: 'bg-error-50',    headerText: 'text-error-800',   headerBorder: 'border-error-200'   },
};

// ─── Skeleton for the full page ───────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="card card-md">
        <div className="flex items-start gap-5">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
        <div className="flex gap-3 pt-4 mt-4 border-t border-neutral-100">
          <Skeleton className="h-9 w-44 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      {/* Score cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonStat key={i} />)}
      </div>
      {/* Chart + breakdown skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <div className="card card-md space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function AIAssessmentReport() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [report,        setReport]        = useState<AIReport | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [advancing,     setAdvancing]     = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [savingDecision,setSavingDecision]= useState(false);

  // Recruiter decision state
  const [nextStage,       setNextStage]      = useState('');
  const [recruiterNotes,  setRecruiterNotes] = useState('');
  const [showAdvanceMenu, setShowAdvanceMenu]= useState(false);
  const [lastSaved,       setLastSaved]      = useState<Date | null>(null);
  const [autoSaving,      setAutoSaving]     = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (id) fetchReport(); }, [id]);

  // Auto-save recruiter notes 30 s after the user stops typing
  useEffect(() => {
    if (!recruiterNotes.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await apiClient.post(`/applications/${id}/notes`, { notes: recruiterNotes });
        setLastSaved(new Date());
      } catch {
        // Silent — notes will be saved on explicit "Save Decision" anyway
      } finally {
        setAutoSaving(false);
      }
    }, 30_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [recruiterNotes, id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/applications/${id}/ai-report`);
      const data: AIReport = res.data;
      setReport(data);
    } catch (err: any) {
      if (err.response?.status === 404) setNotFound(true);
      else toast.error(err.response?.data?.message || 'Failed to load AI report');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async (status: string) => {
    if (!status) return;
    setAdvancing(true);
    setShowAdvanceMenu(false);
    try {
      await apiClient.put(`/applications/${id}/status`, { status });
      toast.success('Application advanced successfully');
      fetchReport();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to advance application');
    } finally {
      setAdvancing(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this candidate?')) return;
    setRejecting(true);
    try {
      await apiClient.put(`/applications/${id}/status`, { status: 'rejected' });
      toast.success('Application rejected');
      navigate(`/applications/${id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject application');
    } finally {
      setRejecting(false);
    }
  };

  const handleShareReport = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success('Report URL copied to clipboard'),
      () => toast.error('Could not copy URL')
    );
  };

  const handleSaveDecision = async () => {
    if (!nextStage && !recruiterNotes.trim()) {
      toast.error('Enter a note or select a stage before saving');
      return;
    }
    setSavingDecision(true);
    try {
      if (nextStage) {
        await apiClient.put(`/applications/${id}/status`, { status: nextStage, notes: recruiterNotes });
      }
      toast.success('Decision saved');
      fetchReport();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save decision');
    } finally {
      setSavingDecision(false);
    }
  };

  // ─── Guard rendering ────────────────────────────────────────────────────────

  if (loading) return <ReportSkeleton />;

  if (notFound || !report) return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to={`/applications/${id}`} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Application
      </Link>
      <div className="card">
        <EmptyState
          icon={
            <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title="No AI Report Found"
          desc="This application does not have a completed AI interview session. AI assessment reports are generated automatically when a candidate completes an AI-conducted interview."
          action={{ label: 'Back to Application', onClick: () => navigate(`/applications/${id}`) }}
        />
      </div>
    </div>
  );

  const rec     = report.recommendation in REC_META ? report.recommendation : 'hold';
  const recMeta = REC_META[rec];

  const radarScores: RadarScores = {
    communication:  report.scores.communication,
    technical:      report.scores.technical,
    confidence:     report.scores.confidence,
    problemSolving: report.scores.problemSolving,
    culturalFit:    report.scores.culturalFit,
  };

  const interviewDate = report.interview.date
    ? format(new Date(report.interview.date), 'dd MMM yyyy, h:mm a')
    : '—';

  const STAGE_OPTIONS = [
    { value: 'shortlisted',           label: 'Shortlist Candidate'        },
    { value: 'interview_scheduled',   label: 'Schedule Panel Interview'   },
    { value: 'selected',              label: 'Select for Offer'           },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link to="/applications" className="hover:text-neutral-700">Applications</Link>
        <span>/</span>
        <Link to={`/applications/${id}`} className="hover:text-neutral-700 truncate max-w-xs">{report.candidate.name}</Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">AI Report</span>
      </div>

      {/* ═══ SECTION 1: Header ══════════════════════════════════════════════════ */}
      <section className="card" aria-labelledby="report-header-heading">
        {/* Recommendation banner */}
        <div className={`-mx-6 -mt-6 px-6 py-3 rounded-t-xl border-b mb-6 ${recMeta.headerBg} ${recMeta.headerBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`font-semibold text-sm ${recMeta.headerText}`}>AI Recommendation</div>
            <Badge variant={recMeta.badgeVariant} className="font-bold uppercase tracking-wide">
              {recMeta.label}
            </Badge>
            <div className="ml-auto text-xs text-neutral-500">
              Powered by {report.interview.aiModel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          {/* Candidate info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Avatar name={report.candidate.name} src={report.candidate.profileImage} size="xl" />
            <div className="min-w-0">
              <h1 id="report-header-heading" className="text-xl font-bold text-neutral-900 truncate">
                {report.candidate.name}
              </h1>
              <p className="text-sm text-neutral-500 truncate">{report.candidate.email}</p>
              <p className="text-sm font-semibold text-neutral-700 mt-1">{report.job.title}</p>
            </div>
          </div>

          {/* Interview meta */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm shrink-0">
            {[
              { dt: 'Date',     dd: interviewDate                        },
              { dt: 'Duration', dd: `${report.interview.duration} min`   },
              { dt: 'Round',    dd: report.interview.round               },
              { dt: 'Sessions', dd: `${report.questionsAnswered} Qs`     },
            ].map(({ dt, dd }) => (
              <div key={dt}>
                <dt className="text-neutral-400 font-medium">{dt}</dt>
                <dd className="text-neutral-800 font-semibold">{dd}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-5 mt-5 border-t border-neutral-100">
          {/* Advance dropdown */}
          <div className="relative">
            <Button
              variant="primary"
              loading={advancing}
              onClick={() => setShowAdvanceMenu(s => !s)}
              iconRight={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              }
            >
              Advance to Next Stage
            </Button>
            {showAdvanceMenu && (
              <div className="absolute top-full left-0 mt-1 z-10 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                {STAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleAdvance(opt.value)}
                    className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="destructive" loading={rejecting} onClick={handleReject}>
            Reject
          </Button>

          <Button variant="ghost" onClick={handleShareReport}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Report
          </Button>

          <Link to={`/applications/${id}`} className="ml-auto text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Application
          </Link>
        </div>
      </section>

      {/* ═══ SECTION 2: Score overview ══════════════════════════════════════════ */}
      <section aria-label="Score overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Communication"
            value={`${report.scores.communication}%`}
            iconBg="bg-info-50"
            sub={`${report.scores.communication >= 70 ? 'Above' : 'Below'} average`}
            icon={
              <svg className="w-5 h-5 text-info-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatCard
            label="Technical Competency"
            value={`${report.scores.technical}%`}
            iconBg="bg-primary-50"
            sub={`${report.questionsAnswered} questions answered`}
            icon={
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }
          />
          <StatCard
            label="Confidence Score"
            value={`${report.scores.confidence}%`}
            iconBg="bg-success-50"
            sub={report.scores.confidence >= 70 ? 'Strong presence' : 'Needs development'}
            icon={
              <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <StatCard
            label="Overall AI Score"
            value={`${report.scores.overall}%`}
            iconBg="bg-warning-50"
            trend={{
              value: `${report.questionsPassed}/${report.questionsAnswered} passed`,
              neutral: true,
            }}
            icon={
              <svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ═══ SECTION 3: Competency analysis (60 / 40) ══════════════════════════ */}
      <section aria-labelledby="breakdown-heading">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT 60% — Radar chart */}
          <div className="lg:col-span-3 card card-md">
            <h2 id="breakdown-heading" className="text-h3 text-neutral-900 mb-1">
              Competency Radar
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              Candidate vs. role benchmark across five dimensions
            </p>
            <ScoreRadar scores={radarScores} />
          </div>

          {/* RIGHT 40% — AI Analysis panel */}
          <div className="lg:col-span-2 bg-neutral-50 rounded-xl border border-neutral-200 p-5 flex flex-col gap-5">

            {/* AI Summary */}
            {report.aiSummary && (
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  AI Summary
                </p>
                <p className="text-sm text-neutral-700 leading-relaxed">{report.aiSummary}</p>
              </div>
            )}

            {/* Strengths */}
            {report.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-success-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Strengths
                </p>
                <ul className="space-y-1.5">
                  {report.strengths.slice(0, 4).map((s, i) => (
                    <li key={i} className="text-sm text-neutral-600 flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-success-500 shrink-0 mt-1.5" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Development Areas */}
            {report.improvements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-warning-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Development Areas
                </p>
                <ul className="space-y-1.5">
                  {report.improvements.slice(0, 4).map((s, i) => (
                    <li key={i} className="text-sm text-neutral-600 flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning-500 shrink-0 mt-1.5" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Decision box */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 mt-auto">
              <div className="flex items-start gap-3">
                {/* Decision icon — coloured by recommendation */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${recMeta.headerBg} border ${recMeta.headerBorder}`}>
                  <svg className={`w-5 h-5 ${recMeta.headerText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {rec === 'strong_hire' || rec === 'hire' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : rec === 'reject' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    AI Decision
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${recMeta.headerText}`}>
                    {recMeta.label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Confidence:{' '}
                    <span className="font-semibold text-neutral-700">
                      {report.scores.overall}%
                    </span>
                    {' '}overall score
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: Proctoring observations (only if events exist) ═════════ */}
      {report.proctoringEvents.length > 0 && (
        <ViolationTimeline events={report.proctoringEvents} />
      )}

      {/* ═══ SECTION 5: Transcript ══════════════════════════════════════════════ */}
      <TranscriptViewer
        transcript={report.transcript}
        candidateName={report.candidate.name}
        jobTitle={report.job.title}
        interviewDate={interviewDate}
      />

      {/* ═══ SECTION 6: Recruiter decision ═════════════════════════════════════ */}
      <section className="card card-md" aria-labelledby="decision-heading">
        <h2 id="decision-heading" className="text-h3 text-neutral-900 mb-4">Recruiter Decision</h2>

        <div className="space-y-4">

          {/* Notes — with auto-save indicator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="recruiter-notes" className="block text-sm font-medium text-neutral-700">
                Recruiter Notes
                <span className="text-neutral-400 font-normal ml-1">(collaborative — visible to your team)</span>
              </label>
              {/* Auto-save status */}
              <span className="text-xs text-neutral-400 flex items-center gap-1 shrink-0">
                {autoSaving ? (
                  <>
                    <svg className="w-3 h-3 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Saving…
                  </>
                ) : lastSaved ? (
                  <>
                    <svg className="w-3 h-3 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : recruiterNotes.trim() ? (
                  'Auto-saves in 30s'
                ) : null}
              </span>
            </div>
            <textarea
              id="recruiter-notes"
              value={recruiterNotes}
              onChange={e => setRecruiterNotes(e.target.value)}
              placeholder="Add your observations, concerns, or reasons for the decision…"
              rows={4}
              className="w-full px-4 py-3 text-sm border border-neutral-200 rounded-xl resize-none
                         focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300
                         placeholder-neutral-400"
            />
          </div>

          {/* Stage selector */}
          <div>
            <label htmlFor="next-stage" className="block text-sm font-medium text-neutral-700 mb-1.5">
              Advance to Stage
            </label>
            <select
              id="next-stage"
              value={nextStage}
              onChange={e => setNextStage(e.target.value)}
              className="w-full sm:w-72 px-4 py-2.5 text-sm border border-neutral-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 bg-white"
            >
              <option value="">— No stage change —</option>
              <option value="shortlisted">Shortlist Candidate</option>
              <option value="interview_scheduled">Schedule Panel Interview</option>
              <option value="selected">Select for Offer</option>
              <option value="rejected">Reject</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              loading={savingDecision}
              onClick={handleSaveDecision}
              disabled={!nextStage && !recruiterNotes.trim()}
            >
              Save &amp; Advance Stage
            </Button>
            {(nextStage || recruiterNotes.trim()) && (
              <button
                onClick={() => { setNextStage(''); setRecruiterNotes(''); setLastSaved(null); }}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
