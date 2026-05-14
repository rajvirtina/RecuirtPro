import { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { StatCard } from '../components/ui/StatCard';
import { SkeletonStat, Skeleton } from '../components/ui/Skeleton';

/* ── Inline mini-chart components (no library needed) ── */
function BarChart({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2.5">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-32 truncate shrink-0">{s.label}</span>
          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${s.color}`}
              style={{ width: `${(s.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-neutral-700 w-10 text-right tabular-nums shrink-0">
            {s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function FunnelChart({ stages }: { stages: { label: string; count: number; pct: number }[] }) {
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.label} className="relative">
          <div
            className={`flex items-center justify-between px-4 py-2.5 rounded-md transition-all ${
              i === 0 ? 'bg-primary-600 text-white' :
              i === 1 ? 'bg-primary-500 text-white' :
              i === 2 ? 'bg-primary-400 text-white' :
              i === 3 ? 'bg-success-500 text-white' :
                        'bg-success-600 text-white'
            }`}
            style={{ marginLeft: `${i * 16}px`, marginRight: `${i * 16}px` }}
          >
            <span className="text-sm font-medium">{s.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{s.count}</span>
              {i > 0 && (
                <span className="text-xs opacity-75">{s.pct}% conv.</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices }: { slices: { label: string; count: number; color: string }[] }) {
  const total = slices.reduce((a, s) => a + s.count, 0) || 1;
  let offset  = 0;
  const R = 40, circ = 2 * Math.PI * R;

  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" className="-rotate-90 shrink-0">
        {slices.map((s, i) => {
          const dash   = (s.count / total) * circ;
          const gap    = circ - dash;
          const stroke = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={R}
              fill="none"
              strokeWidth="16"
              className={s.color}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-stroke}
            />
          );
        })}
        {/* Center hole */}
        <circle cx="50" cy="50" r="28" fill="white" />
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color.replace('stroke-','bg-')}`} />
              <span className="text-xs text-neutral-600 truncate">{s.label}</span>
            </div>
            <span className="text-xs font-semibold text-neutral-800 tabular-nums shrink-0">
              {Math.round((s.count / (total || 1)) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Analytics Page ────────────────────────────────── */
export default function Analytics() {
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/dashboard/employer')
      .then((res) => setStats(res.data?.data ?? res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* Derive pipeline funnel */
  const overview = stats?.overview ?? {};
  const funnelStages = [
    { label: 'Total Applications', count: overview.totalApplications ?? 0, pct: 100 },
    { label: 'Shortlisted',        count: overview.shortlistedApplications ?? 0,
      pct: overview.totalApplications ? Math.round((overview.shortlistedApplications / overview.totalApplications) * 100) : 0 },
    { label: 'Interviews',         count: overview.scheduledInterviews ?? 0,
      pct: overview.shortlistedApplications ? Math.round((overview.scheduledInterviews / overview.shortlistedApplications) * 100) : 0 },
    { label: 'Selected / Offers',  count: (overview.selectedApplications ?? 0) + (overview.offerReleasedApplications ?? 0),
      pct: overview.scheduledInterviews ? Math.round(((overview.selectedApplications ?? 0) / (overview.scheduledInterviews || 1)) * 100) : 0 },
    { label: 'Hired',              count: overview.hiredApplications ?? 0,
      pct: overview.selectedApplications ? Math.round((overview.hiredApplications / (overview.selectedApplications || 1)) * 100) : 0 },
  ];

  const statusBreakdown = [
    { label: 'Applied',      count: overview.totalApplications ?? 0,         color: 'stroke-info-500' },
    { label: 'Shortlisted',  count: overview.shortlistedApplications ?? 0,   color: 'stroke-warning-500' },
    { label: 'Interviewing', count: overview.scheduledInterviews ?? 0,       color: 'stroke-primary-500' },
    { label: 'Hired',        count: overview.hiredApplications ?? 0,         color: 'stroke-success-600' },
    { label: 'Rejected',     count: overview.rejectedApplications ?? 0,      color: 'stroke-error-500' },
  ];

  const stageBar = [
    { label: 'Applied',     count: overview.totalApplications ?? 0,       color: 'bg-info-500' },
    { label: 'Shortlisted', count: overview.shortlistedApplications ?? 0, color: 'bg-warning-500' },
    { label: 'Interview',   count: overview.scheduledInterviews ?? 0,     color: 'bg-primary-500' },
    { label: 'Selected',    count: overview.selectedApplications ?? 0,    color: 'bg-success-500' },
    { label: 'Hired',       count: overview.hiredApplications ?? 0,       color: 'bg-success-700' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Recruitment performance overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Live data
        </div>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonStat key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Jobs"
            value={overview.activeJobs ?? 0}
            iconBg="bg-primary-50"
            icon={<svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          />
          <StatCard
            label="Total Applications"
            value={overview.totalApplications ?? 0}
            iconBg="bg-info-50"
            icon={<svg className="w-5 h-5 text-info-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <StatCard
            label="Conversion Rate"
            value={`${overview.totalApplications ? Math.round(((overview.hiredApplications ?? 0) / overview.totalApplications) * 100) : 0}%`}
            iconBg="bg-success-50"
            icon={<svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            sub="Applications → Hired"
          />
          <StatCard
            label="Interviews This Month"
            value={overview.scheduledInterviews ?? 0}
            iconBg="bg-warning-50"
            icon={<svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hiring funnel */}
        <div className="card card-md">
          <h2 className="text-h3 mb-5">Hiring Funnel</h2>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" style={{ marginLeft: `${i * 16}px`, marginRight: `${i * 16}px` } as any} />
              ))}
            </div>
          ) : (
            <FunnelChart stages={funnelStages} />
          )}
        </div>

        {/* Status breakdown donut */}
        <div className="card card-md">
          <h2 className="text-h3 mb-5">Application Status Mix</h2>
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="space-y-2 flex-1">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
              </div>
            </div>
          ) : (
            <DonutChart slices={statusBreakdown.filter((s) => s.count > 0)} />
          )}
        </div>

        {/* Stage breakdown bar */}
        <div className="card card-md lg:col-span-2">
          <h2 className="text-h3 mb-5">Pipeline Stage Breakdown</h2>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 rounded-full" />)}
            </div>
          ) : (
            <BarChart stages={stageBar} />
          )}
        </div>
      </div>

      {/* Empty state when no data */}
      {!loading && overview.totalApplications === 0 && (
        <div className="card text-center py-16">
          <svg className="w-10 h-10 text-neutral-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-neutral-600">No analytics data yet</p>
          <p className="text-xs text-neutral-400 mt-1">Data will appear once you have active jobs and applications.</p>
        </div>
      )}
    </div>
  );
}
