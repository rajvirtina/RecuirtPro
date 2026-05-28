import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import ApplicationForm from '../../components/applications/ApplicationForm';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SkeletonPage } from '../../components/ui/Skeleton';

interface Job {
  _id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  location: string;
  jobType: string;
  workMode: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  skills: string[];
  status: string;
  companyId: string;
  createdBy: string;
  positions?: number;
  tags?: string[];
  viewCount?: number;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

type ConfirmAction = 'delete' | 'close' | 'hold' | null;

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-neutral-500">
      <span className="text-neutral-400" aria-hidden="true">{icon}</span>
      {text}
    </span>
  );
}

const CONFIRM_CONFIG: Record<string, { title: string; message: string; label: string }> = {
  delete: {
    title: 'Delete this job posting?',
    message: 'All applications for this job will be permanently removed. This cannot be undone.',
    label: 'Delete Job',
  },
  close: {
    title: 'Close this job posting?',
    message: 'The job will stop accepting new applications. Existing candidates will not be affected.',
    label: 'Close Job',
  },
  hold: {
    title: 'Put this job on hold?',
    message: 'The job will stop accepting new applications until you resume it.',
    label: 'Put on Hold',
  },
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [job, setJob]                         = useState<Job | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [confirmAction, setConfirmAction]     = useState<ConfirmAction>(null);
  const [actionPending, setActionPending]     = useState(false);

  useEffect(() => { fetchJobDetail(); }, [id]);

  const fetchJobDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/jobs/${id}`);
      setJob(response.data.job);
    } catch {
      toast.error('Failed to load job details');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  /** Shared status updater — called after confirm */
  const performStatusChange = async (newStatus: string) => {
    setActionPending(true);
    try {
      await apiClient.patch(`/jobs/${id}/status`, { status: newStatus });
      toast.success(`Job ${newStatus.replace('_', ' ')} successfully`);
      setConfirmAction(null);
      await fetchJobDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to set status to ${newStatus}`);
    } finally {
      setActionPending(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmAction === 'delete') {
      setActionPending(true);
      try {
        await apiClient.delete(`/jobs/${id}`);
        toast.success('Job deleted', { description: 'This action cannot be undone.' });
        navigate('/jobs');
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to delete job');
      } finally {
        setActionPending(false);
        setConfirmAction(null);
      }
    } else if (confirmAction === 'close') {
      await performStatusChange('closed');
    } else if (confirmAction === 'hold') {
      await performStatusChange('on_hold');
    }
  };

  const handlePublishJob = () => performStatusChange('published');

  if (loading) return <SkeletonPage />;

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-h2 text-neutral-900">Job not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/jobs')}>
          ← Back to Jobs
        </Button>
      </div>
    );
  }

  const isOwner  = user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin';
  const canApply = user?.role === 'candidate' && (job.status === 'published' || job.status === 'active');

  const formatSalary = () => {
    if (!job.salaryMin && !job.salaryMax) return null;
    const toLPA = (n: number) => {
      const lpa = n / 100_000;
      return `₹${lpa % 1 === 0 ? lpa : lpa.toFixed(1)} LPA`;
    };
    if (job.salaryMin && job.salaryMax) return `${toLPA(job.salaryMin)} – ${toLPA(job.salaryMax)}`;
    if (job.salaryMin) return `From ${toLPA(job.salaryMin)}`;
    return `Up to ${toLPA(job.salaryMax!)}`;
  };

  const salary = formatSalary();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </Button>

      {/* Main card */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-h1 text-neutral-900">{job.title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {job.location && (
                  <MetaChip
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    text={job.location}
                  />
                )}
                {job.jobType && (
                  <MetaChip
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    text={job.jobType.replace('_', ' ').toUpperCase()}
                  />
                )}
                {job.workMode && (
                  <MetaChip
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    text={job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)}
                  />
                )}
                <MetaChip
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  text={`${job.experienceMin}–${job.experienceMax} yrs exp`}
                />
                {salary && (
                  <MetaChip
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    text={salary}
                  />
                )}
              </div>
            </div>
            <StatusBadge status={job.status} />
          </div>

          {/* Stats row */}
          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-400">
            <span>Posted {new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {job.applicationCount !== undefined && (
              <span>{job.applicationCount} application{job.applicationCount !== 1 ? 's' : ''}</span>
            )}
            {job.positions && job.positions > 1 && (
              <span>{job.positions} positions available</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          {job.description && (
            <section>
              <h2 className="text-h3 text-neutral-900 mb-3">Job Description</h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </section>
          )}

          {job.requirements && job.requirements.length > 0 && (
            <section>
              <h2 className="text-h3 text-neutral-900 mb-3">Requirements</h2>
              <ul className="space-y-1.5">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="mt-1 w-1.5 h-1.5 bg-primary-400 rounded-full shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {job.skills && job.skills.length > 0 && (
            <section>
              <h2 className="text-h3 text-neutral-900 mb-3">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex gap-3 flex-wrap items-center">
          {canApply && job.status !== 'closed' && (
            <Button variant="primary" onClick={() => setShowApplicationForm(true)}>
              Apply Now
            </Button>
          )}

          {user?.role === 'candidate' && job.status === 'closed' && (
            <p className="text-sm text-error-600 font-medium">This position is closed.</p>
          )}

          {!user && (
            <Button variant="primary" onClick={() => navigate('/login', { state: { from: `/jobs/${id}` } })}>
              Login to Apply
            </Button>
          )}

          {isOwner && (
            <div className="flex gap-2 flex-wrap ml-auto">
              {(job.status === 'draft' || job.status === 'closed' || job.status === 'on_hold') && (
                <Button variant="primary" loading={actionPending} onClick={handlePublishJob}>
                  {job.status === 'draft' ? 'Publish Job' : 'Resume Job'}
                </Button>
              )}
              {job.status === 'published' && (
                <>
                  <Button variant="secondary" onClick={() => setConfirmAction('hold')}>
                    Put on Hold
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmAction('close')}>
                    Close Job
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => navigate(`/jobs/${id}/edit`)}>
                Edit Job
              </Button>
              {(user?.role === 'hr' || user?.role === 'admin') && (
                <Button variant="destructive" onClick={() => setConfirmAction('delete')}>
                  Delete Job
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div
          className="fixed inset-0 bg-neutral-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowApplicationForm(false); }}
        >
          <ApplicationForm
            jobId={id!}
            onSuccess={() => {
              setShowApplicationForm(false);
              toast.success('Application submitted successfully!');
            }}
            onCancel={() => setShowApplicationForm(false)}
          />
        </div>
      )}

      {/* Confirm dialog for destructive actions */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={CONFIRM_CONFIG[confirmAction ?? 'delete']?.title ?? ''}
        message={CONFIRM_CONFIG[confirmAction ?? 'delete']?.message}
        confirmLabel={CONFIRM_CONFIG[confirmAction ?? 'delete']?.label ?? 'Confirm'}
        variant="destructive"
        loading={actionPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
