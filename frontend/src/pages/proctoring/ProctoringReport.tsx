/**
 * ProctoringReport — recruiter-facing proctoring review component.
 * Shown as the "Proctoring" tab on ApplicationDetail.tsx.
 *
 * Fetches GET /api/v1/proctoring/application/:applicationId/report
 */
import { useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import apiClient from '../../services/api';
import { Badge }    from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
type Severity  = 'low' | 'medium' | 'high' | 'critical';

interface ProctoringEventItem {
  _id:         string;
  eventType:   string;
  severity:    Severity;
  timestamp:   string;
  description: string;
  snapshotUrl?: string;
  reviewed:    boolean;
  reviewComments?: string;
}

interface Summary {
  total:      number;
  reviewed:   number;
  unreviewed: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byType:     Record<string, number>;
}

interface ReportData {
  hasData:           boolean;
  riskLevel:         RiskLevel;
  interviewId:       string;
  proctoringEnabled: boolean;
  summary:           Summary;
  assessment:        string;
  events:            ProctoringEventItem[];
}

interface Props {
  applicationId: string;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  tab_switch:          'Tab Switch',
  window_blur:         'Window Focus Lost',
  multiple_faces:      'Multiple Faces',
  no_face_detected:    'No Face Detected',
  suspicious_behavior: 'Copy / Paste Attempt',
  consent_given:       'Consent Granted',
  consent_denied:      'Consent Declined',
  face_detected:       'Face Detected',
  gaze_away:           'Gaze Away',
  audio_issue:         'Audio Issue',
  video_issue:         'Video Issue',
  violation:           'Proctoring Violation',
};

const EVENT_ICONS: Record<string, string> = {
  tab_switch:          '🔄',
  window_blur:         '👁️',
  multiple_faces:      '👥',
  no_face_detected:    '❌',
  suspicious_behavior: '📋',
  consent_given:       '✅',
  consent_denied:      '🚫',
  gaze_away:           '👀',
  audio_issue:         '🔇',
  video_issue:         '📹',
};

const SEVERITY_VARIANT: Record<Severity, 'red' | 'yellow' | 'gray' | 'blue'> = {
  critical: 'red',
  high:     'red',
  medium:   'yellow',
  low:      'gray',
};

const RISK_META: Record<RiskLevel, {
  bg: string; border: string; text: string; dot: string; label: string; icon: string;
}> = {
  HIGH:   { bg: 'bg-error-50',   border: 'border-error-200',   text: 'text-error-800',   dot: 'bg-error-500',   label: 'High Risk',   icon: '⚠️' },
  MEDIUM: { bg: 'bg-warning-50', border: 'border-warning-200', text: 'text-warning-800', dot: 'bg-warning-500', label: 'Medium Risk', icon: '!' },
  LOW:    { bg: 'bg-success-50', border: 'border-success-200', text: 'text-success-800', dot: 'bg-success-500', label: 'Low Risk',    icon: '✓' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-neutral-500 capitalize">{label}</p>
    </div>
  );
}

function ViolationRow({
  event,
  onReview,
}: {
  event: ProctoringEventItem;
  onReview: (id: string) => void;
}) {
  const label = EVENT_LABELS[event.eventType] || event.eventType.replace(/_/g, ' ');
  const icon  = EVENT_ICONS[event.eventType]  || '🔔';

  return (
    <div
      className={`relative pl-6 pb-5 last:pb-0 border-l-2 ${
        event.reviewed ? 'border-neutral-200' : 'border-primary-300'
      }`}
    >
      {/* Timeline dot */}
      <span
        className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
          event.reviewed ? 'bg-neutral-300' : 'bg-primary-400'
        }`}
        aria-hidden="true"
      />

      <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-3 space-y-2">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base" aria-hidden="true">{icon}</span>
          <span className="text-sm font-semibold text-neutral-900">{label}</span>
          <Badge variant={SEVERITY_VARIANT[event.severity]} className="text-xs capitalize">
            {event.severity}
          </Badge>
          {event.reviewed && (
            <Badge variant="green" className="text-xs">Reviewed</Badge>
          )}
          <time
            className="ml-auto text-xs text-neutral-400"
            dateTime={event.timestamp}
            title={event.timestamp}
          >
            {format(new Date(event.timestamp), 'HH:mm:ss')}
            <span className="ml-1 text-neutral-300">
              ({formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })})
            </span>
          </time>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-xs text-neutral-600">{event.description}</p>
        )}

        {/* Screenshot */}
        {event.snapshotUrl && event.snapshotUrl.startsWith('data:image') && (
          <img
            src={event.snapshotUrl}
            alt={`Webcam snapshot at ${event.timestamp}`}
            className="h-20 rounded border border-neutral-200 object-cover"
            loading="lazy"
          />
        )}

        {/* Review comment */}
        {event.reviewComments && (
          <p className="text-xs text-neutral-500 italic">
            Review note: {event.reviewComments}
          </p>
        )}

        {/* Mark as reviewed button */}
        {!event.reviewed && (
          <button
            onClick={() => onReview(event._id)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Mark as reviewed
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
      <Skeleton className="h-8 rounded-lg" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProctoringReport({ applicationId }: Props) {
  const [report,  setReport]  = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!applicationId) return;
    fetchReport();
  }, [applicationId]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/proctoring/application/${applicationId}/report`);
      setReport(res.data as ReportData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load proctoring report');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (eventId: string) => {
    const note = window.prompt('Add a review note (optional):') ?? '';
    try {
      await apiClient.put(`/proctoring/event/${eventId}/review`, { reviewComments: note });
      fetchReport(); // refresh
    } catch {
      /* silently fail */
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <ReportSkeleton />;

  if (error) return (
    <div className="py-8 text-center">
      <p className="text-sm text-error-600">{error}</p>
      <button onClick={fetchReport} className="mt-2 text-xs text-primary-600 hover:underline">
        Retry
      </button>
    </div>
  );

  if (!report || !report.hasData) return (
    <EmptyState
      icon={
        <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      }
      title={report?.proctoringEnabled === false ? 'Proctoring not enabled' : 'No proctoring data'}
      desc={
        report?.proctoringEnabled === false
          ? 'This interview was not proctored.'
          : 'No violations or monitoring events were recorded for this session.'
      }
    />
  );

  const riskMeta = RISK_META[report.riskLevel ?? 'LOW'];

  return (
    <div className="space-y-5">
      {/* Risk level banner */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${riskMeta.bg} ${riskMeta.border}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${riskMeta.bg}`}>
          {riskMeta.icon}
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${riskMeta.text}`}>
            Risk Level
          </p>
          <p className={`text-xl font-bold leading-tight ${riskMeta.text}`}>
            {riskMeta.label}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className={`text-2xl font-bold ${riskMeta.text}`}>{report.summary.total}</p>
          <p className="text-xs text-neutral-500">violations</p>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
          <SeverityCount label="Critical" count={report.summary.bySeverity.critical} color="text-error-700" />
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
          <SeverityCount label="High"     count={report.summary.bySeverity.high}     color="text-error-500" />
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
          <SeverityCount label="Medium"   count={report.summary.bySeverity.medium}   color="text-warning-600" />
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
          <SeverityCount label="Low"      count={report.summary.bySeverity.low}      color="text-neutral-500" />
        </div>
      </div>

      {/* Review progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500">
          {report.summary.reviewed} of {report.summary.total} violations reviewed
        </span>
        <span className={report.summary.unreviewed > 0 ? 'text-warning-600 font-medium' : 'text-success-600 font-medium'}>
          {report.summary.unreviewed > 0 ? `${report.summary.unreviewed} unreviewed` : 'All reviewed'}
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden" aria-hidden="true">
        <div
          className="h-full bg-primary-500 rounded-full transition-all"
          style={{
            width: report.summary.total > 0
              ? `${(report.summary.reviewed / report.summary.total) * 100}%`
              : '0%',
          }}
        />
      </div>

      {/* Overall assessment */}
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
          Assessment
        </p>
        <p className="text-sm text-neutral-700 leading-relaxed">{report.assessment}</p>
      </div>

      {/* Violations timeline */}
      {report.events.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">
            Violations Timeline
          </h3>
          <div className="space-y-0">
            {report.events.map(event => (
              <ViolationRow key={event._id} event={event} onReview={handleReview} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-400 text-center py-4">
          No violation events to display.
        </p>
      )}
    </div>
  );
}
