import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';

export interface ViolationEvent {
  id: string;
  type: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  snapshotUrl?: string;
}

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface ViolationTimelineProps {
  events: ViolationEvent[];
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  face_not_detected:       'Face Not Detected',
  no_face_detected:        'No Face Detected',
  multiple_faces:          'Multiple Faces',
  gaze_away:               'Gaze Away',
  tab_switch:              'Tab Switch',
  window_blur:             'Window Blur / Focus Lost',
  unauthorized_app:        'Unauthorised Application',
  external_device:         'External Device Detected',
  audio_issue:             'Audio Issue',
  video_issue:             'Video Issue',
  multiple_browser_tabs:   'Multiple Browser Tabs',
  multiple_displays:       'Multiple Displays',
  suspicious_behavior:     'Suspicious Behaviour',
  system_resource_issue:   'System Resource Issue',
  consent_given:           'Consent Given',
  interview_started:       'Interview Started',
  interview_ended:         'Interview Ended',
  system_check_passed:     'System Check Passed',
  screenshot_captured:     'Screenshot Captured',
};

const SEVERITY_STYLES = {
  low:      { badge: 'gray'   as const, dot: 'bg-neutral-400',  ring: 'ring-neutral-200',  label: 'Low'      },
  medium:   { badge: 'yellow' as const, dot: 'bg-warning-500',  ring: 'ring-warning-200',  label: 'Medium'   },
  high:     { badge: 'red'    as const, dot: 'bg-error-500',    ring: 'ring-error-200',    label: 'High'     },
  critical: { badge: 'red'    as const, dot: 'bg-error-700',    ring: 'ring-error-300',    label: 'Critical' },
};

const RISK_STYLES: Record<RiskLevel, { badge: 'green' | 'yellow' | 'red'; bg: string; text: string; icon: string }> = {
  LOW:    { badge: 'green',  bg: 'bg-success-50 border-success-200',  text: 'text-success-700',  icon: '✓' },
  MEDIUM: { badge: 'yellow', bg: 'bg-warning-50 border-warning-200',  text: 'text-warning-700',  icon: '!' },
  HIGH:   { badge: 'red',    bg: 'bg-error-50   border-error-200',    text: 'text-error-700',    icon: '⚠' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRisk(events: ViolationEvent[]): RiskLevel {
  const criticals = events.filter(e => e.severity === 'critical').length;
  const highs     = events.filter(e => e.severity === 'high').length;
  const mediums   = events.filter(e => e.severity === 'medium').length;
  if (criticals > 0 || highs >= 3) return 'HIGH';
  if (highs > 0   || mediums >= 3) return 'MEDIUM';
  return 'LOW';
}

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ViolationTimeline({ events }: ViolationTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Only show substantive violations (exclude system events like consent_given)
  const SYSTEM_EVENTS = new Set(['consent_given', 'interview_started', 'interview_ended', 'system_check_passed']);

  const violations = useMemo(
    () => events.filter(e => !SYSTEM_EVENTS.has(e.type)),
    [events]
  );

  const risk    = useMemo(() => computeRisk(violations), [violations]);
  const riskMeta = RISK_STYLES[risk];

  const filtered = useMemo(() => {
    if (filter === 'all') return violations;
    return violations.filter(e => e.severity === filter);
  }, [violations, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 5);

  const counts = useMemo(() => ({
    critical: violations.filter(e => e.severity === 'critical').length,
    high:     violations.filter(e => e.severity === 'high').length,
    medium:   violations.filter(e => e.severity === 'medium').length,
    low:      violations.filter(e => e.severity === 'low').length,
  }), [violations]);

  return (
    <section className="card" aria-labelledby="proctoring-heading">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-neutral-100 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="proctoring-heading" className="text-h3 text-neutral-900">Proctoring Observations</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{violations.length} event{violations.length !== 1 ? 's' : ''} recorded during the interview</p>
        </div>

        {/* Risk badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${riskMeta.bg}`}>
          <span className={`text-lg font-bold ${riskMeta.text}`} aria-hidden="true">{riskMeta.icon}</span>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${riskMeta.text}`}>Risk Level</p>
            <p className={`text-lg font-bold leading-tight ${riskMeta.text}`}>{risk}</p>
          </div>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="px-6 py-4 grid grid-cols-4 gap-3 border-b border-neutral-100">
        {(['critical', 'high', 'medium', 'low'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`text-center p-3 rounded-lg border transition-all ${
              filter === s
                ? 'border-primary-300 bg-primary-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <p className={`text-xl font-bold ${
              s === 'critical' || s === 'high' ? 'text-error-600' :
              s === 'medium'  ? 'text-warning-600' : 'text-neutral-500'
            }`}>{counts[s]}</p>
            <p className="text-xs text-neutral-500 capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="px-6 py-4">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-10 h-10 bg-success-50 rounded-full flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-700">No proctoring violations recorded</p>
            <p className="text-xs text-neutral-400 mt-1">The session completed cleanly</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">
            No {filter} severity events. <button className="text-primary-600 underline" onClick={() => setFilter('all')}>Show all</button>
          </p>
        ) : (
          <ol className="relative border-l border-neutral-200 space-y-0" aria-label="Proctoring events timeline">
            {visible.map((event, idx) => {
              const sev = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.low;
              const label = EVENT_LABELS[event.type] || event.type.replace(/_/g, ' ');
              return (
                <li key={event.id || idx} className="pb-5 pl-6 last:pb-0">
                  {/* Timeline dot */}
                  <span
                    className={`absolute -left-1.5 flex items-center justify-center w-3 h-3 rounded-full ring-2 ring-white ${sev.dot}`}
                    aria-hidden="true"
                  />

                  <article className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-white transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={sev.badge}>
                          {sev.label}
                        </Badge>
                        <span className="text-sm font-medium text-neutral-900">{label}</span>
                      </div>
                      <time className="text-xs text-neutral-400 shrink-0" dateTime={event.timestamp}>
                        {fmt(event.timestamp)}
                      </time>
                    </div>

                    {event.description && (
                      <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">{event.description}</p>
                    )}

                    {event.snapshotUrl && (
                      <div className="mt-2">
                        <img
                          src={event.snapshotUrl}
                          alt={`Screenshot at ${fmt(event.timestamp)}`}
                          className="h-20 rounded border border-neutral-200 object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        {filtered.length > 5 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAll ? '↑ Show fewer' : `↓ Show all ${filtered.length} events`}
          </button>
        )}
      </div>
    </section>
  );
}
