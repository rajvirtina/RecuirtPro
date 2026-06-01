import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Application } from '../../types';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyApplications } from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'sonner';
import { staggerContainer, staggerItem, slideDownVariants } from '../../lib/motion';

const STATUS_TABS = [
  { label: 'All',         value: '' },
  { label: 'Applied',     value: 'applied' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Interview',   value: 'interview_scheduled' },
  { label: 'Selected',    value: 'selected' },
  { label: 'Rejected',    value: 'rejected' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AIScorePill({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-neutral-400">—</span>;
  const pct = Math.round(score);
  const cls =
    pct >= 70 ? 'bg-success-50 border-success-200 text-success-700' :
    pct >= 40 ? 'bg-warning-50 border-warning-200 text-warning-700' :
                'bg-error-50   border-error-200   text-error-700';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
      title={`AI overall fit: ${pct}%`}
      aria-label={`AI match score: ${pct} percent`}
    >
      {pct}% match
    </span>
  );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return (
    <svg className="w-3 h-3 text-neutral-300 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
  return (
    <svg className="w-3 h-3 text-primary-600 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={asc ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Applications() {
  const user       = useAuthStore(s => s.user);
  const navigate   = useNavigate();
  const isEmployer = ['employer', 'hr', 'admin'].includes(user?.role ?? '');

  /* ── URL-synced filter state ──────────────────────────────── */
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab  = searchParams.get('stage')    ?? '';
  const search     = searchParams.get('search')   ?? '';
  const minScore   = searchParams.get('minScore') ?? '';
  const expMinParam= searchParams.get('expMin')   ?? '';
  const expMaxParam= searchParams.get('expMax')   ?? '';
  const skillsParam= useMemo(() => searchParams.getAll('skills'), [searchParams]);

  function setFilter(key: string, value: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }

  function toggleSkillFilter(skill: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const existing = next.getAll('skills');
      next.delete('skills');
      if (existing.includes(skill)) {
        existing.filter(s => s !== skill).forEach(s => next.append('skills', s));
      } else {
        [...existing, skill].forEach(s => next.append('skills', s));
      }
      return next;
    }, { replace: true });
  }

  function clearSmartFilters() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      ['minScore', 'expMin', 'expMax', 'skills'].forEach(k => next.delete(k));
      return next;
    }, { replace: true });
  }

  /* ── Local state ──────────────────────────────────────────── */
  const [applications, setApplications]     = useState<Application[]>([]);
  const [loading, setLoading]               = useState(true);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);
  const [withdrawing, setWithdrawing]       = useState(false);
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [parsing, setParsing]               = useState(false);
  const [ranking, setRanking]               = useState(false);
  const [showFilters, setShowFilters]       = useState(false);
  const [sortKey, setSortKey]               = useState<'score' | ''>('');
  const [sortAsc, setSortAsc]               = useState(false);

  useEffect(() => {
    setSelected(new Set());
    fetchApplications();
  }, [activeTab]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const qs = activeTab ? `?status=${activeTab}` : '';
      const res = await apiClient.get(`/applications${qs}`);
      setApplications((res.data as any) || []);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    try {
      setWithdrawing(true);
      await apiClient.delete(`/applications/${withdrawTarget}`);
      toast.success('Application withdrawn');
      fetchApplications();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
      setWithdrawTarget(null);
    }
  };

  /* ── Bulk parse (uses backend sequential endpoint, rate-limit safe) ──── */
  const handleBulkParse = async () => {
    if (selected.size === 0) return;
    setParsing(true);
    try {
      const res = await apiClient.post('/applications/bulk-parse', {
        applicationIds: Array.from(selected),
      });
      const { parsed = 0, failed = 0 } = (res.data as any) ?? {};
      toast.success(`Parsed ${parsed} resume${parsed !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`);
      setSelected(new Set());
      fetchApplications();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Bulk parse failed');
    } finally {
      setParsing(false);
    }
  };

  /* ── Rank all (requires a jobId context) ─────────────────── */
  const jobIdParam = searchParams.get('jobId') ?? '';
  const handleRankAll = async () => {
    if (!jobIdParam) {
      toast.error('Filter by a specific job first to rank candidates');
      return;
    }
    setRanking(true);
    try {
      await apiClient.post(`/jobs/${jobIdParam}/rank-candidates`);
      toast.success('Candidates ranked successfully');
      fetchApplications();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to rank candidates');
    } finally {
      setRanking(false);
    }
  };

  /* ── Selection helpers ────────────────────────────────────── */
  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selected.size === displayed.length && displayed.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((a: any) => a._id)));
    }
  };

  /* ── Derived skill list for autocomplete ─────────────────── */
  const availableSkills = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a: any) => {
      (a.parsedSkills ?? []).forEach((s: string) => set.add(s));
    });
    return Array.from(set).sort();
  }, [applications]);

  const hasSmartFilters = !!(minScore || expMinParam || expMaxParam || skillsParam.length);

  /* ── Client-side search + smart filters ──────────────────── */
  const debouncedSearch = useDebounce(search, 300);

  const displayed = useMemo(() => {
    let list: any[] = applications;

    // Text search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a => {
        const name  = `${a.candidateId?.firstName ?? ''} ${a.candidateId?.lastName ?? ''}`.toLowerCase();
        const title = (a.jobId?.title ?? a.job?.title ?? '').toLowerCase();
        return name.includes(q) || title.includes(q);
      });
    }

    // Smart filters (employer only)
    if (isEmployer) {
      if (minScore) list = list.filter(a => (a.overallScore ?? -1) >= parseInt(minScore));
      if (expMinParam) list = list.filter(a => (a.parsedExperienceYears ?? 0) >= parseFloat(expMinParam));
      if (expMaxParam) list = list.filter(a => (a.parsedExperienceYears ?? Infinity) <= parseFloat(expMaxParam));
      if (skillsParam.length > 0) {
        list = list.filter(a => {
          const appSkills = (a.parsedSkills ?? []).map((s: string) => s.toLowerCase());
          return skillsParam.some(s => appSkills.includes(s.toLowerCase()));
        });
      }
    }

    // Sort
    if (sortKey === 'score') {
      list = [...list].sort((a, b) => {
        const diff = (b.overallScore ?? -1) - (a.overallScore ?? -1);
        return sortAsc ? -diff : diff;
      });
    }

    return list;
  }, [applications, debouncedSearch, minScore, expMinParam, expMaxParam, skillsParam, sortKey, sortAsc, isEmployer]);

  const allSelected = displayed.length > 0 && selected.size === displayed.length;

  /* ── Render ──────────────────────────────────────────────── */
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="p-6 space-y-5"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
    >
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">{isEmployer ? 'Applications' : 'My Applications'}</h1>
          <p className="page-subtitle">
            {loading ? '…' : `${displayed.length} application${displayed.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk parse (employer, selection > 0) */}
          {isEmployer && selected.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={parsing}
              onClick={handleBulkParse}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
            >
              Parse Resumes ({selected.size})
            </Button>
          )}
          {/* Rank all (employer, jobId param present) */}
          {isEmployer && jobIdParam && (
            <Button
              variant="secondary"
              size="sm"
              loading={ranking}
              onClick={handleRankAll}
            >
              Rank All
            </Button>
          )}
          {!isEmployer && (
            <Button variant="primary" onClick={() => navigate('/candidate/jobs')}>
              Browse Jobs
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setFilter('stage', t.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-all ${
                  activeTab === t.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            {/* Search (employer) */}
            {isEmployer && (
              <Input
                placeholder="Search candidates or positions…"
                value={search}
                onChange={e => setFilter('search', e.target.value)}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                className="w-56"
              />
            )}

            {/* Smart filters toggle (employer) */}
            {isEmployer && (
              <button
                onClick={() => setShowFilters(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-all ${
                  hasSmartFilters || showFilters
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" />
                </svg>
                AI Filters
                {hasSmartFilters && (
                  <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {[minScore, expMinParam, expMaxParam, ...skillsParam].filter(Boolean).length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Smart filters panel */}
        <AnimatePresence>
        {isEmployer && showFilters && (
          <motion.div
            className="card card-md"
            variants={reduced ? undefined : slideDownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-700">AI-Powered Filters</h3>
              {hasSmartFilters && (
                <button onClick={clearSmartFilters} className="text-xs text-error-600 hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Min AI Score slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Min AI Score
                  </label>
                  <span className="text-xs font-bold text-primary-700">{minScore || '0'}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minScore || '0'}
                  onChange={e => setFilter('minScore', e.target.value === '0' ? '' : e.target.value)}
                  className="w-full accent-primary-600"
                  aria-label="Minimum AI score filter"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* Experience range */}
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Experience (years)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Min"
                    value={expMinParam}
                    onChange={e => setFilter('expMin', e.target.value)}
                    className="field-input w-full"
                    aria-label="Minimum experience years"
                  />
                  <span className="text-neutral-400 text-sm shrink-0">–</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Max"
                    value={expMaxParam}
                    onChange={e => setFilter('expMax', e.target.value)}
                    className="field-input w-full"
                    aria-label="Maximum experience years"
                  />
                </div>
              </div>

              {/* Skills multi-select */}
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Skills
                </label>
                {availableSkills.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Parse resumes to populate skills</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {availableSkills.map(skill => (
                      <button
                        key={skill}
                        onClick={() => toggleSkillFilter(skill)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                          skillsParam.includes(skill)
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-700'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="card overflow-hidden overflow-x-auto">
        {loading ? (
          <div>{[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : displayed.length === 0 ? (
          <EmptyApplications isCandidate={!isEmployer} />
        ) : (
          <>
            {/* Desktop header */}
            <div
              className={`hidden md:grid gap-4 px-5 py-3 border-b border-neutral-100 text-xs font-semibold text-neutral-400 uppercase tracking-wider ${
                isEmployer
                  ? 'grid-cols-[28px_1fr_150px_120px_140px_auto]'
                  : 'grid-cols-[1fr_150px_120px_auto]'
              }`}
            >
              {isEmployer && (
                <label className="flex items-center cursor-pointer" aria-label="Select all">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                </label>
              )}
              <span>{isEmployer ? 'Candidate / Position' : 'Position'}</span>
              <span>Applied</span>
              <span>Status</span>
              {isEmployer && (
                <button
                  onClick={() => {
                    if (sortKey === 'score') setSortAsc(a => !a);
                    else { setSortKey('score'); setSortAsc(false); }
                  }}
                  className="flex items-center text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-neutral-700"
                >
                  AI Score <SortIcon active={sortKey === 'score'} asc={sortAsc} />
                </button>
              )}
              <span />
            </div>

            <motion.div
              className="divide-y divide-neutral-100"
              variants={reduced ? undefined : staggerContainer(0.04)}
              initial="hidden"
              animate="visible"
            >
              {displayed.map((app: any) => {
                const candidateName = isEmployer
                  ? `${app.candidateId?.firstName ?? ''} ${app.candidateId?.lastName ?? ''}`.trim() || 'Candidate'
                  : undefined;
                const jobTitle  = app.jobId?.title  ?? app.job?.title  ?? 'Position';
                const location  = app.jobId?.location ?? app.job?.location ?? '';
                const appliedAt = new Date(app.appliedAt || app.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                });
                const isParsed  = !!app.parsedAt;
                const score     = app.overallScore ?? app.skillMatchScore;
                const source    = app.source as string | undefined;

                return (
                  <motion.div
                    key={app._id}
                    className="group hover:bg-neutral-50 transition-colors"
                    variants={reduced ? undefined : staggerItem}
                  >
                    <div
                      className={`flex md:grid items-center gap-4 px-5 py-4 ${
                        isEmployer
                          ? 'md:grid-cols-[28px_1fr_150px_120px_140px_auto]'
                          : 'md:grid-cols-[1fr_150px_120px_auto]'
                      }`}
                    >
                      {/* Checkbox (employer) */}
                      {isEmployer && (
                        <label className="hidden md:flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={selected.has(app._id)}
                            onChange={() => toggleSelect(app._id)}
                            className="w-4 h-4 rounded accent-primary-600"
                            aria-label={`Select ${candidateName}`}
                          />
                        </label>
                      )}

                      {/* Identity */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isEmployer ? (
                          <Avatar name={candidateName} size="sm" />
                        ) : (
                          <div className="w-8 h-8 bg-primary-50 rounded-md flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {isEmployer ? candidateName : jobTitle}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-neutral-500 truncate">
                              {isEmployer ? jobTitle : location}
                            </p>
                            {/* Parsed indicator */}
                            {isEmployer && isParsed && (
                              <span className="text-[10px] text-success-600 font-medium flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Parsed
                              </span>
                            )}
                            {/* Source badge */}
                            {isEmployer && source && source !== 'direct' && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                source === 'naukri' ? 'bg-blue-50 text-blue-700' :
                                source === 'linkedin' ? 'bg-sky-50 text-sky-700' :
                                source === 'referral' ? 'bg-purple-50 text-purple-700' :
                                'bg-neutral-50 text-neutral-600'
                              }`}>
                                {source === 'naukri' ? 'Naukri' : source === 'linkedin' ? 'LinkedIn' : source === 'referral' ? 'Referral' : source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Applied date */}
                      <p className="hidden md:block text-sm text-neutral-500 shrink-0">{appliedAt}</p>

                      {/* Status */}
                      <div className="hidden md:block shrink-0">
                        <StatusBadge status={app.status} />
                      </div>

                      {/* AI Score — employer only */}
                      {isEmployer && (
                        <div className="hidden md:block shrink-0">
                          <AIScorePill score={score} />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-auto shrink-0">
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
                            onClick={() => setWithdrawTarget(app._id)}
                            className="btn btn-sm btn-ghost text-error-500 hover:bg-error-50"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}
      </div>

      {/* Withdraw dialog */}
      <ConfirmDialog
        open={withdrawTarget !== null}
        title="Withdraw application?"
        message="This will remove your application. The employer will be notified. This cannot be undone."
        confirmLabel="Withdraw"
        variant="destructive"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </motion.div>
  );
}
