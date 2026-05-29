import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { SkeletonRow } from '../../components/ui/Skeleton';

interface Interview {
  _id: string;
  job: { title: string };
  candidate?: { firstName: string; lastName: string; email: string };
  scheduledTime: string;
  duration: number;
  status: string;
  meetingLink?: string;
  round?: string;
  feedbackStatus?: 'pending' | 'partial' | 'completed';
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}
function isFuture(dateStr: string) {
  return new Date(dateStr) > new Date();
}

export default function InterviewerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [upcoming, setUpcoming] = useState<Interview[]>([]);
  const [pending, setPending]   = useState<Interview[]>([]);
  const [stats, setStats]       = useState({ today: 0, thisWeek: 0, pendingFeedback: 0 });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [scheduledRes, completedRes] = await Promise.all([
          apiClient.get('/interviews?status=scheduled&limit=50'),
          apiClient.get('/interviews?status=completed&limit=50'),
        ]);
        const scheduled: Interview[] = (scheduledRes.data as any) || [];
        const completed: Interview[] = (completedRes.data as any) || [];

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const upcomingList = scheduled
          .filter((iv) => isFuture(iv.scheduledTime))
          .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
          .slice(0, 8);

        const pendingList = completed.filter(
          (iv) => iv.feedbackStatus !== 'completed'
        );

        const todayCount = scheduled.filter((iv) => isToday(iv.scheduledTime)).length;
        const weekCount = scheduled.filter((iv) => {
          const d = new Date(iv.scheduledTime);
          return d >= weekStart && d < weekEnd;
        }).length;

        setUpcoming(upcomingList);
        setPending(pendingList);
        setStats({ today: todayCount, thisWeek: weekCount, pendingFeedback: pendingList.length });
      } catch {
        // non-critical — page shows empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const todayInterviews = upcoming.filter((iv) => isToday(iv.scheduledTime));
  const laterInterviews = upcoming.filter((iv) => !isToday(iv.scheduledTime));

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Good {greeting()}, {user?.firstName}</h1>
          <p className="page-subtitle">Here's your interview schedule and pending scorecards</p>
        </div>
        <Link to="/interviews">
          <Button variant="secondary" size="sm">View All Interviews</Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Interviews" value={stats.today} color="blue" />
        <StatCard label="This Week" value={stats.thisWeek} color="indigo" />
        <StatCard label="Pending Scorecards" value={stats.pendingFeedback} color={stats.pendingFeedback > 0 ? 'amber' : 'green'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming interviews */}
        <section className="card">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Upcoming Interviews</h2>
            <Link to="/interviews?status=scheduled" className="text-xs text-primary-600 hover:text-primary-800 font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y divide-neutral-50">
            {loading ? (
              <div className="px-5 py-2">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <CalendarEmptyIcon />
                <p className="text-sm text-neutral-500">No upcoming interviews</p>
              </div>
            ) : (
              <>
                {todayInterviews.length > 0 && (
                  <div>
                    <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-primary-600 bg-primary-50/50">Today</p>
                    {todayInterviews.map((iv) => <InterviewRow key={iv._id} iv={iv} showJoin />)}
                  </div>
                )}
                {laterInterviews.length > 0 && (
                  <div>
                    {todayInterviews.length > 0 && (
                      <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 bg-neutral-50/80">Upcoming</p>
                    )}
                    {laterInterviews.map((iv) => <InterviewRow key={iv._id} iv={iv} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Pending scorecards */}
        <section className="card">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">
              Pending Scorecards
              {stats.pendingFeedback > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">
                  {stats.pendingFeedback}
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-neutral-50">
            {loading ? (
              <div className="px-5 py-2">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <CheckCircleIcon />
                <p className="text-sm text-neutral-500">All scorecards submitted</p>
              </div>
            ) : (
              pending.map((iv) => <ScorecardRow key={iv._id} iv={iv} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber:  'bg-amber-50 text-amber-700',
    green:  'bg-success-50 text-success-700',
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${colorMap[color]}`}>
        {value}
      </div>
      <p className="text-sm text-neutral-600 font-medium">{label}</p>
    </div>
  );
}

function InterviewRow({ iv, showJoin }: { iv: Interview; showJoin?: boolean }) {
  const candidateName = iv.candidate
    ? `${iv.candidate.firstName} ${iv.candidate.lastName}`
    : 'Candidate';
  const roundLabel = iv.round === 'L1' ? 'R1' : iv.round === 'L2' ? 'R2' : iv.round === 'L3' ? 'R3' : iv.round === 'final' ? 'Final' : '';

  return (
    <div className="px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors">
      {/* Time block */}
      <div className="text-center shrink-0 w-12">
        <p className="text-xs font-semibold text-neutral-900">{formatTime(iv.scheduledTime)}</p>
        {!isToday(iv.scheduledTime) && (
          <p className="text-[10px] text-neutral-400">{formatDate(iv.scheduledTime)}</p>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">{iv.job?.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Avatar name={candidateName} size="xs" />
          <span className="text-xs text-neutral-500 truncate">{candidateName}</span>
          {roundLabel && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
              {roundLabel}
            </span>
          )}
        </div>
      </div>
      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        <StatusBadge status={iv.status} />
        {showJoin && iv.meetingLink && (
          <Link to={`/interviews/${iv._id}/room`}>
            <Button variant="primary" size="sm">Join</Button>
          </Link>
        )}
        {!showJoin && (
          <Link to={`/interviews/${iv._id}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function ScorecardRow({ iv }: { iv: Interview }) {
  const candidateName = iv.candidate
    ? `${iv.candidate.firstName} ${iv.candidate.lastName}`
    : 'Candidate';

  return (
    <div className="px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">{iv.job?.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Avatar name={candidateName} size="xs" />
          <span className="text-xs text-neutral-500 truncate">{candidateName}</span>
          <span className="text-[10px] text-neutral-400">· {formatDate(iv.scheduledTime)}</span>
        </div>
      </div>
      <Link to={`/interviews/${iv._id}/feedback`}>
        <Button variant="primary" size="sm">Submit Scorecard</Button>
      </Link>
    </div>
  );
}

function CalendarEmptyIcon() {
  return (
    <svg className="w-10 h-10 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-10 h-10 text-success-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
