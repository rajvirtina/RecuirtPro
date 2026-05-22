import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useQuery }          from '@tanstack/react-query';
import apiClient             from '../services/api';
import { StatCard }          from '../components/ui/StatCard';
import { Button }            from '../components/ui/Button';
import { EmptyState }        from '../components/ui/EmptyState';
import { Skeleton, SkeletonStat } from '../components/ui/Skeleton';
import { FunnelChart }       from '../components/charts/FunnelChart';
import { TimeSeriesChart }   from '../components/charts/TimeSeriesChart';
import { SourceDonut }       from '../components/charts/SourceDonut';
import { TimeToHireBar }     from '../components/charts/TimeToHireBar';
import { OfferRateChart }    from '../components/charts/OfferRateChart';
import { AIScoreHistogram }  from '../components/charts/AIScoreHistogram';

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePreset = '7d' | '30d' | '90d' | 'custom';
type SortKey    = 'name' | 'applicationsReviewed' | 'interviewsScheduled' | 'offersMade' | 'avgResponseTimeHours';

// ─── Date range helpers ────────────────────────────────────────────────────────

function computeRange(preset: DatePreset, customStart: string, customEnd: string) {
  const today = new Date();
  switch (preset) {
    case '7d':  return { start: format(subDays(today, 7),  'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case '90d': return { start: format(subDays(today, 90), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'custom': return { start: customStart || format(subDays(today, 30), 'yyyy-MM-dd'), end: customEnd || format(today, 'yyyy-MM-dd') };
    default:    return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className={`animate-pulse rounded-xl bg-neutral-100`} style={{ height }} />
  );
}

function SectionCard({ title, subtitle, children, loading, empty, onEmpty }: {
  title:    string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?:   boolean;
  onEmpty?: string;
}) {
  return (
    <div className="card card-md">
      <div className="mb-4">
        <h2 className="text-h3 text-neutral-900">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {loading ? (
        <SkeletonChart />
      ) : empty ? (
        <div className="py-8">
          <EmptyState
            title="No data for this period"
            desc={onEmpty ?? 'Try selecting a wider date range or check back once more data is collected.'}
          />
        </div>
      ) : children}
    </div>
  );
}

// ─── Recruiter productivity table ─────────────────────────────────────────────

function RecruiterTable({ recruiters, loading }: { recruiters: any[]; loading: boolean }) {
  const [sortKey,  setSortKey]  = useState<SortKey>('applicationsReviewed');
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    if (!recruiters) return [];
    return [...recruiters].sort((a, b) => {
      const va = a[sortKey] ?? -1;
      const vb = b[sortKey] ?? -1;
      if (typeof va === 'string') return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDesc ? vb - va : va - vb;
    });
  }, [recruiters, sortKey, sortDesc]);

  const maxResponseHours = useMemo(
    () => Math.max(1, ...recruiters.map(r => r.avgResponseTimeHours ?? 0)),
    [recruiters]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  };

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-neutral-700 select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
      aria-sort={sortKey === col ? (sortDesc ? 'descending' : 'ascending') : 'none'}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col ? (
          <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={sortDesc ? 'M7 7l5 5 5-5' : 'M7 17l5-5 5 5'} />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    </th>
  );

  if (loading) return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
    </div>
  );

  if (!recruiters || recruiters.length === 0) return (
    <EmptyState
      title="No recruiter activity"
      desc="No HR team members had activity in this date range. Expand the range or invite team members."
    />
  );

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm" aria-label="Recruiter productivity">
        <thead className="border-b border-neutral-100">
          <tr>
            <Th col="name"                   label="Recruiter" />
            <Th col="applicationsReviewed"   label="Apps Reviewed" />
            <Th col="interviewsScheduled"    label="Interviews" />
            <Th col="offersMade"             label="Offers" />
            <Th col="avgResponseTimeHours"   label="Avg Response Time" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {sorted.map(r => (
            <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-neutral-900 truncate max-w-[160px]">{r.name}</p>
                  <p className="text-xs text-neutral-400 truncate max-w-[160px]">{r.email}</p>
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums font-semibold text-neutral-800">
                {r.applicationsReviewed}
              </td>
              <td className="px-4 py-3 tabular-nums font-semibold text-neutral-800">
                {r.interviewsScheduled}
              </td>
              <td className="px-4 py-3 tabular-nums font-semibold text-neutral-800">
                {r.offersMade}
              </td>
              <td className="px-4 py-3">
                {r.avgResponseTimeHours != null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full bg-warning-400 rounded-full"
                        style={{ width: `${Math.min(100, (r.avgResponseTimeHours / maxResponseHours) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-600 tabular-nums whitespace-nowrap">
                      {r.avgResponseTimeHours < 24
                        ? `${r.avgResponseTimeHours.toFixed(1)}h`
                        : `${(r.avgResponseTimeHours / 24).toFixed(1)}d`}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-400 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function Analytics() {
  const [preset,      setPreset]      = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  const { start, end } = useMemo(
    () => computeRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const qs = `startDate=${start}&endDate=${end}`;

  // ── React Query data fetchers ───────────────────────────────────────────────
  const qOpts = { staleTime: 5 * 60 * 1000 };

  const { data: funnelRes, isPending: funnelPending } = useQuery({
    queryKey: ['analytics', 'funnel', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/funnel?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: tsRes, isPending: tsPending } = useQuery({
    queryKey: ['analytics', 'timeSeries', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/applications-over-time?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: srcRes, isPending: srcPending } = useQuery({
    queryKey: ['analytics', 'sources', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/source-breakdown?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: tthRes, isPending: tthPending } = useQuery({
    queryKey: ['analytics', 'timeToHire', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/time-to-hire?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: rpRes, isPending: rpPending } = useQuery({
    queryKey: ['analytics', 'recruiterProductivity', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/recruiter-productivity?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: offerRes, isPending: offerPending } = useQuery({
    queryKey: ['analytics', 'offerRate', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/offer-rate?${qs}`); return r.data as any; },
    ...qOpts,
  });

  const { data: aiScoreRes, isPending: aiScorePending } = useQuery({
    queryKey: ['analytics', 'aiScoreDistribution', start, end],
    queryFn:  async () => { const r = await apiClient.get(`/analytics/ai-score-distribution?${qs}`); return r.data as any; },
    ...qOpts,
  });

  // ── Derived values ──────────────────────────────────────────────────────────

  const funnel   = funnelRes?.funnel   ?? [];
  const summary  = funnelRes?.summary  ?? {};
  const tsSeries = tsRes?.series       ?? [];
  const sources  = srcRes?.sources     ?? [];
  const srcTotal = srcRes?.total       ?? 0;
  const depts    = tthRes?.departments ?? [];
  const compAvg  = tthRes?.companyAvg  ?? 0;
  const recruiters = rpRes?.recruiters ?? [];
  const offerBreakdown   = offerRes?.breakdown     ?? [];
  const offerAcceptRate  = offerRes?.acceptanceRate ?? 0;
  const scoreHistogram   = aiScoreRes?.histogram   ?? [];
  const scoreStats       = aiScoreRes?.stats       ?? {};

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleExport = () => window.print();

  // ── Date range presets ──────────────────────────────────────────────────────
  const PRESETS: { label: string; value: DatePreset }[] = [
    { label: 'Last 7 days',  value: '7d'  },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Custom',       value: 'custom' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Hiring Analytics</h1>
          <p className="page-subtitle">
            {start} — {end}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date preset buttons */}
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  preset === p.value
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5 text-sm">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="field-input py-1.5"
                aria-label="Start date"
              />
              <span className="text-neutral-400">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="field-input py-1.5"
                aria-label="End date"
              />
            </div>
          )}

          {/* Export */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            Export PDF Report
          </Button>
        </div>
      </div>

      {/* ── KPI summary row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {funnelPending ? (
          [...Array(4)].map((_, i) => <SkeletonStat key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Applications"
              value={(summary.totalApplications ?? 0).toLocaleString()}
              iconBg="bg-primary-50"
              sub={`${start} — ${end}`}
              icon={<svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            />
            <StatCard
              label="Total Hired"
              value={(summary.hired ?? 0).toLocaleString()}
              iconBg="bg-success-50"
              sub="Hired in period"
              icon={<svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            <StatCard
              label="Overall Conversion"
              value={`${summary.overallConversionRate ?? 0}%`}
              iconBg="bg-info-50"
              sub="Applied → Hired"
              icon={<svg className="w-5 h-5 text-info-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
            <StatCard
              label="In Pipeline"
              value={((summary.shortlisted ?? 0) + (summary.interviewed ?? 0)).toLocaleString()}
              iconBg="bg-warning-50"
              sub="Shortlisted + Interviewed"
              icon={<svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" /></svg>}
            />
          </>
        )}
      </div>

      {/* ── Chart 1: Conversion Funnel (full width) ──────────── */}
      <SectionCard
        title="Conversion Funnel"
        subtitle="How candidates move through each hiring stage"
        loading={funnelPending}
        empty={!funnelPending && funnel.length === 0}
        onEmpty="No applications found in this date range. Try expanding the period."
      >
        <FunnelChart data={funnel} />
      </SectionCard>

      {/* ── Chart 2 + 3: Time series + Source donut (50/50) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Applications Over Time"
          subtitle="Total vs AI-qualified (overall score ≥ 70%)"
          loading={tsPending}
          empty={!tsPending && tsSeries.length === 0}
        >
          <TimeSeriesChart data={tsSeries} />
        </SectionCard>

        <SectionCard
          title="Source Breakdown"
          subtitle="Where candidates are coming from"
          loading={srcPending}
          empty={!srcPending && sources.length === 0}
        >
          <SourceDonut data={sources} total={srcTotal} />
        </SectionCard>
      </div>

      {/* ── Chart 4: Time to Hire by Department (full width) ──── */}
      <SectionCard
        title="Time to Hire by Department"
        subtitle="Average days from application to hire — green bars are below company average"
        loading={tthPending}
        empty={!tthPending && depts.length === 0}
        onEmpty="No completed hires in this period. Time-to-hire data appears once candidates reach Hired status."
      >
        <TimeToHireBar departments={depts} companyAvg={compAvg} />
      </SectionCard>

      {/* ── Chart 5: Recruiter Productivity (full width table) ── */}
      <div className="card card-md">
        <div className="mb-4">
          <h2 className="text-h3 text-neutral-900">Recruiter Productivity</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Activity per HR team member — click column headers to sort</p>
        </div>
        <RecruiterTable recruiters={recruiters} loading={rpPending} />
      </div>

      {/* ── Chart 6 + 7: Offer Rate + AI Score Distribution (50/50) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Offer Acceptance Rate"
          subtitle="Breakdown of offers sent vs outcomes"
          loading={offerPending}
          empty={!offerPending && offerBreakdown.length === 0}
          onEmpty="No offers sent in this period. Data will appear once offers are sent to candidates."
        >
          <OfferRateChart data={offerBreakdown} acceptanceRate={offerAcceptRate} />
        </SectionCard>

        <SectionCard
          title="AI Interview Score Distribution"
          subtitle={scoreStats.total ? `${scoreStats.total} scored candidates — avg ${scoreStats.average}` : 'Score histogram across all candidates'}
          loading={aiScorePending}
          empty={!aiScorePending && scoreHistogram.every((b: any) => b.count === 0)}
          onEmpty="No AI-scored candidates in this period. Scores appear once AI interviews are completed."
        >
          <AIScoreHistogram data={scoreHistogram} average={scoreStats.average} />
        </SectionCard>
      </div>

    </div>
  );
}
