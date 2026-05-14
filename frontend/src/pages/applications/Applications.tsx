import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Application } from '../../types';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyApplications } from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { label: 'All',               value: '' },
  { label: 'Applied',           value: 'applied' },
  { label: 'Shortlisted',       value: 'shortlisted' },
  { label: 'Interview',         value: 'interview_scheduled' },
  { label: 'Selected',          value: 'selected' },
  { label: 'Rejected',          value: 'rejected' },
];

function ScoreBar({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      <div className="score-bar w-20">
        <div className={`score-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-600 font-medium">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function Applications() {
  const user    = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const isEmployer = user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin';

  const [applications, setApplications]   = useState<Application[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('');
  const [search, setSearch]               = useState('');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => { fetchApplications(); }, [activeTab]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const url = activeTab ? `/applications?status=${activeTab}` : '/applications';
      const res  = await apiClient.get(url);
      setApplications((res.data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!window.confirm('Withdraw this application? This cannot be undone.')) return;
    try {
      setWithdrawingId(id);
      await apiClient.delete(`/applications/${id}`);
      toast.success('Application withdrawn');
      fetchApplications();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to withdraw');
    } finally {
      setWithdrawingId(null);
    }
  };

  const displayed = search.trim()
    ? applications.filter((a: any) => {
        const name = `${a.candidateId?.firstName ?? ''} ${a.candidateId?.lastName ?? ''}`.toLowerCase();
        const title = (a.jobId?.title ?? a.job?.title ?? '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || title.includes(q);
      })
    : applications;

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEmployer ? 'Applications' : 'My Applications'}</h1>
          <p className="page-subtitle">
            {loading ? '…' : `${displayed.length} application${displayed.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!isEmployer && (
          <Button variant="primary" onClick={() => navigate('/candidate/jobs')}>
            Browse Jobs
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Tab pills */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all border ${
                activeTab === t.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {isEmployer && (
          <div className="relative sm:ml-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search candidates or jobs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input pl-9 w-64"
            />
          </div>
        )}
      </div>

      {/* Applications table/list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div>
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyApplications isCandidate={!isEmployer} />
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px_auto] gap-4 px-5 py-3 border-b border-neutral-100 text-label text-neutral-400 uppercase tracking-wider text-xs">
              <span>{isEmployer ? 'Candidate / Position' : 'Position'}</span>
              <span>Applied</span>
              <span>Status</span>
              {isEmployer && <span>Match</span>}
              <span />
            </div>

            <div className="divide-y divide-neutral-100">
              {displayed.map((app: any) => {
                const candidateName = isEmployer
                  ? `${app.candidateId?.firstName ?? ''} ${app.candidateId?.lastName ?? ''}`.trim() || 'Candidate'
                  : undefined;
                const jobTitle = app.jobId?.title ?? app.job?.title ?? 'Position';
                const appliedDate = new Date(app.appliedAt || app.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                });
                const score = app.overallScore ?? app.skillMatchScore;

                return (
                  <div
                    key={app._id}
                    className="group hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex md:grid md:grid-cols-[1fr_160px_120px_100px_auto] items-center gap-4 px-5 py-4">
                      {/* Candidate / Job info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isEmployer ? (
                          <Avatar name={candidateName} size="sm" />
                        ) : (
                          <div className="w-8 h-8 bg-primary-50 rounded-md flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {isEmployer ? candidateName : jobTitle}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">
                            {isEmployer ? jobTitle : (app.jobId?.location ?? app.job?.location ?? '')}
                          </p>
                        </div>
                      </div>

                      {/* Applied date */}
                      <p className="hidden md:block text-sm text-neutral-500 shrink-0">{appliedDate}</p>

                      {/* Status */}
                      <div className="hidden md:block shrink-0">
                        <StatusBadge status={app.status} />
                      </div>

                      {/* Match score — employer only */}
                      {isEmployer && (
                        <div className="hidden md:block">
                          <ScoreBar score={score} />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        {/* Mobile status */}
                        <div className="md:hidden mr-2">
                          <StatusBadge status={app.status} />
                        </div>

                        <Link
                          to={`/applications/${app._id}`}
                          className="btn btn-sm btn-ghost text-neutral-600 hover:text-primary-600"
                        >
                          View
                        </Link>

                        {!isEmployer && app.status === 'applied' && (
                          <button
                            onClick={() => handleWithdraw(app._id)}
                            disabled={withdrawingId === app._id}
                            className="btn btn-sm btn-ghost text-error-500 hover:bg-error-50"
                          >
                            {withdrawingId === app._id ? '…' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
