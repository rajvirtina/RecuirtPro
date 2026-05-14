import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { SkeletonPage } from '../components/ui/Skeleton';
import { EmptyApplications } from '../components/ui/EmptyState';

/* ── Icon helpers ──────────────────────────────────────────────── */
function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

const ICONS = {
  jobs:      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  apps:      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  trending:  'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  pending:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check:     'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  plus:      'M12 4v16m8-8H4',
  arrow:     'M14 5l7 7m0 0l-7 7m7-7H3',
  shortlist: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

function PipelineBar({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const total = stages[0]?.count || 1;
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-28 truncate shrink-0">{s.label}</span>
          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${s.color}`}
              style={{ width: `${Math.min(100, (s.count / total) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-neutral-700 w-6 text-right shrink-0">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Candidate Dashboard ──────────────────────────────────────── */
function CandidateDashboard({ user, stats }: { user: any; stats: any }) {
  const navigate = useNavigate();
  const recentApps: any[] = stats?.recentApplications || [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-h1 text-neutral-900">
            Good {getTimeOfDay()}, {user?.firstName} 👋
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Icon d={ICONS.shortlist} className="w-4 h-4" />}
          onClick={() => navigate('/candidate/jobs')}
        >
          Browse Jobs
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Applications"
          value={stats?.overview?.totalApplications ?? 0}
          icon={<Icon d={ICONS.apps} />}
          iconBg="bg-info-50"
          sub="All time"
          onClick={() => navigate('/applications')}
        />
        <StatCard
          label="Pending"
          value={stats?.overview?.pendingApplications ?? 0}
          icon={<Icon d={ICONS.pending} />}
          iconBg="bg-warning-50"
          sub="Awaiting response"
        />
        <StatCard
          label="Shortlisted"
          value={stats?.overview?.shortlistedApplications ?? 0}
          icon={<Icon d={ICONS.check} />}
          iconBg="bg-success-50"
          sub="By employers"
        />
        <StatCard
          label="Upcoming Interviews"
          value={stats?.overview?.upcomingInterviews ?? 0}
          icon={<Icon d={ICONS.calendar} />}
          iconBg="bg-primary-50"
          sub="Scheduled"
          onClick={() => navigate('/interviews')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent applications */}
        <div className="lg:col-span-2 card">
          <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-neutral-100">
            <h2 className="text-h3">Recent Applications</h2>
            <Link to="/applications" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <EmptyApplications isCandidate />
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentApps.slice(0, 5).map((app: any) => (
                <Link
                  key={app._id}
                  to={`/applications/${app._id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors group"
                >
                  <div className="w-9 h-9 bg-primary-50 rounded-md flex items-center justify-center shrink-0">
                    <Icon d={ICONS.jobs} className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-primary-600">
                      {app.jobId?.title ?? app.job?.title ?? 'Position'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Applied {new Date(app.appliedAt || app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="card card-md">
            <h3 className="text-h3 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Browse Jobs',       sub: 'Find your next role',       href: '/candidate/jobs', color: 'bg-primary-50 text-primary-600' },
                { label: 'Update Profile',    sub: 'Keep your info current',    href: '/profile',        color: 'bg-success-50 text-success-700' },
                { label: 'My Interviews',     sub: 'View your schedule',        href: '/interviews',     color: 'bg-info-50 text-info-700' },
              ].map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="flex items-center gap-3 p-3 rounded-md border border-neutral-100 hover:border-primary-200 hover:bg-primary-50 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${action.color}`}>
                    <Icon d={ICONS.arrow} className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{action.label}</p>
                    <p className="text-xs text-neutral-500">{action.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Employer Dashboard ───────────────────────────────────────── */
function EmployerDashboard({ user, stats }: { user: any; stats: any }) {
  const navigate = useNavigate();

  const pipelineStages = [
    { label: 'Applied',   count: stats?.pipeline?.applied    ?? stats?.overview?.totalApplications ?? 0,    color: 'bg-info-500' },
    { label: 'Shortlisted',count: stats?.pipeline?.shortlisted ?? stats?.overview?.shortlistedApplications ?? 0, color: 'bg-warning-500' },
    { label: 'Interview', count: stats?.pipeline?.interview  ?? stats?.overview?.scheduledInterviews ?? 0,  color: 'bg-primary-500' },
    { label: 'Offer',     count: stats?.pipeline?.offer      ?? stats?.overview?.offerReleasedApplications ?? 0, color: 'bg-success-500' },
    { label: 'Hired',     count: stats?.pipeline?.hired      ?? stats?.overview?.hiredApplications ?? 0,   color: 'bg-success-700' },
  ];

  const recentApps: any[] = stats?.recentApplications || [];
  const needsAction = recentApps.filter((a: any) =>
    ['applied', 'shortlisted'].includes(a.status)
  ).slice(0, 5);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-h1 text-neutral-900">
            Good {getTimeOfDay()}, {user?.firstName}
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {needsAction.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning-600 font-medium">
                · {needsAction.length} item{needsAction.length > 1 ? 's' : ''} need{needsAction.length === 1 ? 's' : ''} your attention
              </span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Icon d={ICONS.plus} className="w-4 h-4" />}
          onClick={() => navigate('/jobs/new')}
        >
          Post New Job
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Jobs"
          value={stats?.overview?.activeJobs ?? 0}
          icon={<Icon d={ICONS.jobs} />}
          iconBg="bg-primary-50"
          sub={`${stats?.overview?.totalJobs ?? 0} total`}
          onClick={() => navigate('/jobs')}
        />
        <StatCard
          label="Total Applications"
          value={stats?.overview?.totalApplications ?? 0}
          icon={<Icon d={ICONS.apps} />}
          iconBg="bg-info-50"
          sub={`${stats?.overview?.pendingApplications ?? 0} pending review`}
          onClick={() => navigate('/applications')}
        />
        <StatCard
          label="Scheduled Interviews"
          value={stats?.overview?.scheduledInterviews ?? 0}
          icon={<Icon d={ICONS.calendar} />}
          iconBg="bg-success-50"
          sub={`${stats?.overview?.completedInterviews ?? 0} completed`}
          onClick={() => navigate('/interviews')}
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats?.conversionRate?.overallConversion ?? 0}%`}
          icon={<Icon d={ICONS.trending} />}
          iconBg="bg-warning-50"
          sub={`${stats?.overview?.selectedApplications ?? 0} selected`}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Action */}
        <div className="lg:col-span-2 card">
          <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-neutral-100">
            <div>
              <h2 className="text-h3">Needs Review</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Applications awaiting your decision</p>
            </div>
            <Link to="/applications" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>

          {needsAction.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 bg-success-50 rounded-full flex items-center justify-center mb-3">
                <Icon d={ICONS.check} className="w-5 h-5 text-success-600" />
              </div>
              <p className="text-sm font-medium text-neutral-700">All caught up!</p>
              <p className="text-xs text-neutral-500 mt-1">No applications need immediate attention.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {needsAction.map((app: any) => {
                const candidateName = app.candidateId
                  ? `${app.candidateId.firstName ?? ''} ${app.candidateId.lastName ?? ''}`
                  : 'Candidate';
                const daysSince = Math.floor(
                  (Date.now() - new Date(app.appliedAt || app.createdAt).getTime()) / 86400000
                );
                return (
                  <Link
                    key={app._id}
                    to={`/applications/${app._id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors group"
                  >
                    <Avatar name={candidateName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 truncate">
                        {candidateName}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {app.jobId?.title ?? app.job?.title ?? 'Position'} · {daysSince === 0 ? 'today' : `${daysSince}d ago`}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                    <Icon d="M9 5l7 7-7 7" className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Pipeline funnel */}
          <div className="card card-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3">Pipeline Overview</h3>
              <Link to="/applications" className="text-xs text-primary-600 hover:text-primary-700">All jobs</Link>
            </div>
            <PipelineBar stages={pipelineStages} />
          </div>

          {/* Quick actions */}
          <div className="card card-md">
            <h3 className="text-h3 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Post New Job',        href: '/jobs/new',      color: 'text-primary-600 bg-primary-50' },
                { label: 'Review Applications', href: '/applications',  color: 'text-info-700 bg-info-50' },
                { label: 'Schedule Interview',  href: '/interviews',    color: 'text-success-700 bg-success-50' },
                { label: 'Source Candidates',   href: '/sourcing',      color: 'text-warning-700 bg-warning-50' },
              ].map((a) => (
                <Link
                  key={a.href}
                  to={a.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-neutral-100 hover:border-primary-200 hover:bg-primary-50 transition-all text-sm font-medium text-neutral-700 hover:text-primary-700"
                >
                  <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${a.color}`}>
                    <Icon d={ICONS.arrow} className="w-3 h-3" />
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/* ── Main export ─────────────────────────────────────────────── */
export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const endpoint = user.role === 'candidate' ? '/dashboard/candidate' : '/dashboard/employer';
    apiClient.get(endpoint)
      .then((res) => setStats(res.data?.data ?? res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <SkeletonPage />;

  if (user?.role === 'candidate') return <CandidateDashboard user={user} stats={stats} />;
  if (['employer', 'hr', 'admin'].includes(user?.role ?? '')) return <EmployerDashboard user={user} stats={stats} />;

  return (
    <div className="p-6">
      <p className="text-neutral-500">Dashboard not available for your role.</p>
    </div>
  );
}
