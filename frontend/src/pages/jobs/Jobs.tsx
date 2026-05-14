import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Job } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { EmptyJobs } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';

function Icon({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

const FILTER_TABS = [
  { label: 'All',       value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft',     value: 'draft' },
  { label: 'Closed',    value: 'closed' },
];

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function JobCard({ job, isEmployer }: { job: Job; isEmployer: boolean }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const skills = job.skills ?? [];

  return (
    <Link
      to={`/jobs/${job._id}`}
      className="card block hover:border-primary-300 hover:shadow-md transition-all duration-150 group"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Company avatar placeholder */}
          <div className="w-10 h-10 bg-primary-50 rounded-md flex items-center justify-center shrink-0 border border-neutral-100">
            <Icon d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-5 h-5 text-primary-500" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title + status */}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors truncate">
                {job.title}
              </h2>
              <StatusBadge status={job.status} />
            </div>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              {job.location && (
                <span className="flex items-center gap-1">
                  <Icon d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  {job.location}
                </span>
              )}
              {job.jobType && (
                <span className="flex items-center gap-1 capitalize">
                  <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  {job.jobType.replace('_', ' ')}
                </span>
              )}
              {job.workMode && (
                <span className="capitalize">{job.workMode}</span>
              )}
              {(job.experienceMin !== undefined || job.experienceMax !== undefined) && (
                <span>
                  {job.experienceMin ?? 0}–{job.experienceMax ?? '?'} yrs exp
                </span>
              )}
              {salary && (
                <span className="font-medium text-neutral-700">{salary}</span>
              )}
            </div>

            {/* Description */}
            {job.description && (
              <p className="mt-3 text-sm text-neutral-600 line-clamp-2">{job.description}</p>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.slice(0, 6).map((s, i) => (
                  <Badge key={i} variant="purple">{s}</Badge>
                ))}
                {skills.length > 6 && (
                  <Badge variant="gray">+{skills.length - 6}</Badge>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 ml-2">
            {isEmployer && (
              <span className="text-xs text-neutral-400 whitespace-nowrap">
                {job.applicationCount ?? 0} applicant{(job.applicationCount ?? 0) !== 1 ? 's' : ''}
              </span>
            )}
            <Icon d="M9 5l7 7-7 7" className="w-4 h-4 text-neutral-300 group-hover:text-primary-400 transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Jobs() {
  const user       = useAuthStore((state) => state.user);
  const navigate   = useNavigate();
  const isEmployer = ['employer', 'hr', 'admin'].includes(user?.role ?? '');

  /* ── URL-synced filters ──────────────────────────────────── */
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? '';
  const search       = searchParams.get('search') ?? '';

  function setFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }

  const [jobs, setJobs]             = useState<Job[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // UX-005: Debounce the search so we don't filter on every keystroke
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => { fetchJobs(1); }, [statusFilter]);

  const fetchJobs = async (page = 1) => {
    try {
      setLoading(true);
      const candidateStatus = user?.role === 'candidate' ? '&status=published' : '';
      const companyFilter   = isEmployer ? '&companySpecific=true' : '';
      const statusQ         = statusFilter ? `&status=${statusFilter}` : '';
      const res = await apiClient.get(`/jobs?page=${page}&limit=12${candidateStatus}${companyFilter}${statusQ}`);
      setJobs((res.data as any) || []);
      setPagination((res as any).pagination || { page, totalPages: 1, total: (res.data as any)?.length ?? 0 });
    } catch {
      /* silently handle — no toast needed for read failures on initial load */
    } finally {
      setLoading(false);
    }
  };

  // UX-005: filter against the debounced value, not raw keystroke value
  const displayed = debouncedSearch.trim()
    ? jobs.filter((j) =>
        j.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        j.location?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        j.skills?.some((s) => s.toLowerCase().includes(debouncedSearch.toLowerCase()))
      )
    : jobs;

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title">{user?.role === 'candidate' ? 'Find Jobs' : 'Manage Jobs'}</h1>
          <p className="page-subtitle">
            {loading ? '…' : `${pagination.total || displayed.length} job${(pagination.total || displayed.length) !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isEmployer && (
          <Button
            variant="primary"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
            onClick={() => navigate('/jobs/new')}
          >
            Post New Job
          </Button>
        )}
      </div>

      {/* Search + filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search jobs, skills, location…"
          value={search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="max-w-sm"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />

        {/* Status filter tabs — employer only */}
        {isEmployer && (
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-md shrink-0">
            {FILTER_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilter('status', t.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${
                  statusFilter === t.value
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card">
          <EmptyJobs
            canCreate={isEmployer}
            onCreate={() => navigate('/jobs/new')}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((job) => (
            <JobCard key={job._id} job={job} isEmployer={isEmployer} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => fetchJobs(pagination.page - 1)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-neutral-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchJobs(pagination.page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
