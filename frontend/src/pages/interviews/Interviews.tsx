import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyInterviews } from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

interface Interview {
  _id: string;
  job: { title: string; location?: string; };
  candidate?: { firstName: string; lastName: string; email: string; };
  scheduledTime: string;
  duration: number;
  status: string;
  meetingLink?: string;
  round?: string;
  panel: any[];
  proctoringEnabled?: boolean;
}

const FILTER_TABS = [
  { label: 'All',         value: '' },
  { label: 'Scheduled',   value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Cancelled',   value: 'cancelled' },
];

function formatDateTime(dateString: string) {
  const d = new Date(dateString);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    isToday: d.toDateString() === new Date().toDateString(),
    isPast: d < new Date(),
  };
}

export default function Interviews() {
  const user = useAuthStore((state) => state.user);
  const isEmployer = user?.role !== 'candidate';

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');

  const fetchInterviews = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter ? `/interviews?status=${filter}` : '/interviews';
      const res  = await apiClient.get(url);
      setInterviews((res.data as any) || []);
    } catch {
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchInterviews(); }, [fetchInterviews]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this interview? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/interviews/${id}`, { data: { reason: 'Cancelled by interviewer' } });
      toast.success('Interview cancelled');
      fetchInterviews();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to cancel');
    }
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEmployer ? 'Interview Schedule' : 'My Interviews'}</h1>
          <p className="page-subtitle">Manage and join interview sessions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-all ${
              filter === t.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Interview list */}
      <div className="space-y-3">
        {loading ? (
          <div className="card">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : interviews.length === 0 ? (
          <div className="card">
            <EmptyInterviews />
          </div>
        ) : (
          interviews.map((iv) => {
            const dt = formatDateTime(iv.scheduledTime);
            const candidateName = iv.candidate
              ? `${iv.candidate.firstName} ${iv.candidate.lastName}`
              : '';

            return (
              <div key={iv._id} className="card hover:border-primary-200 hover:shadow-sm transition-all duration-150">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Date block */}
                    <div className={`shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center border text-center ${
                      dt.isToday
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : dt.isPast
                        ? 'bg-neutral-50 border-neutral-200 text-neutral-500'
                        : 'bg-primary-50 border-primary-100 text-primary-700'
                    }`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
                        {dt.date.split(',')[0]}
                      </span>
                      <span className="text-xl font-bold leading-tight">
                        {new Date(iv.scheduledTime).getDate()}
                      </span>
                      <span className="text-[10px] leading-none">
                        {dt.date.split(' ')[1]}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h2 className="text-base font-semibold text-neutral-900">
                            {iv.job?.title || 'Interview'}
                          </h2>
                          {isEmployer && candidateName && (
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar name={candidateName} size="xs" />
                              <span className="text-sm text-neutral-600">{candidateName}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-neutral-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {dt.time} · {iv.duration} min
                            </span>
                            {iv.round && (
                              <span className="font-medium text-neutral-600">
                                {iv.round === 'L1' ? 'Round 1' : iv.round === 'L2' ? 'Round 2' : iv.round === 'L3' ? 'Round 3' : 'Final Round'}
                              </span>
                            )}
                            {iv.panel?.length > 0 && (
                              <span>{iv.panel.length} panelist{iv.panel.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={iv.status} />
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {/* Candidate — system check + join */}
                        {!dt.isPast && !isEmployer && (
                          <Link to={`/proctoring-check/${iv._id}`}>
                            <Button variant="primary" size="sm">
                              System Check & Join
                            </Button>
                          </Link>
                        )}

                        {/* Employer — join directly */}
                        {!dt.isPast && isEmployer && iv.meetingLink && (
                          <Link to={`/interviews/${iv._id}/room`}>
                            <Button variant="primary" size="sm">
                              Join Interview
                            </Button>
                          </Link>
                        )}

                        <Link to={`/interviews/${iv._id}`}>
                          <Button variant="secondary" size="sm">Details</Button>
                        </Link>

                        {isEmployer && iv.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-error-600 hover:bg-error-50"
                            onClick={() => handleCancel(iv._id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
