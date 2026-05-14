import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { SkeletonPage } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

interface ApplicationDetail {
  _id: string;
  job: { _id: string; title: string; location?: string; };
  candidate?: { _id?: string; firstName: string; lastName: string; email: string; phone?: string; };
  status: string;
  coverLetter?: string;
  resume?: string;
  skillMatchScore?: number;
  experienceMatchScore?: number;
  overallScore?: number;
  appliedAt: string;
}

type ActiveTab = 'overview' | 'resume' | 'notes';

/* ── Score ring ─────────────────────────────────────────────────── */
function ScoreRing({ value, label, color = 'stroke-primary-500' }: { value: number; label: string; color?: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" className="stroke-neutral-100" />
        <circle
          cx="28" cy="28" r={r} fill="none" strokeWidth="4"
          className={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs text-neutral-900 font-semibold -mt-12 pointer-events-none">{value}%</span>
      <span className="text-[10px] text-neutral-500 mt-7 text-center leading-tight">{label}</span>
    </div>
  );
}

/* ── Schedule Interview Modal ─────────────────────────────────── */
function ScheduleModal({
  application,
  user,
  onClose,
  onScheduled,
}: {
  application: ApplicationDetail;
  user: any;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      setLoading(true);
      const scheduledTime = new Date(`${fd.get('date')}T${fd.get('time')}`).toISOString();
      await apiClient.post('/interviews', {
        applicationId: application._id,
        jobId:         application.job._id,
        candidateId:   application.candidate?._id,
        scheduledTime,
        duration:  parseInt(fd.get('duration') as string) || 60,
        mode:      fd.get('mode'),
        location:  fd.get('location') || '',
        meetingLink: fd.get('meetingLink') || 'https://meet.google.com/' + Math.random().toString(36).substring(7),
        round:     fd.get('round'),
        panel:     [{ userId: user?._id, name: `${user?.firstName} ${user?.lastName}`, email: user?.email, role: user?.role }],
      });
      toast.success('Interview scheduled!');
      onScheduled();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-h3">Schedule Interview</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 rounded-md">
              <p className="text-xs text-neutral-500 mb-0.5">Candidate</p>
              <p className="text-sm font-medium text-neutral-900">
                {application.candidate?.firstName} {application.candidate?.lastName}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded-md">
              <p className="text-xs text-neutral-500 mb-0.5">Position</p>
              <p className="text-sm font-medium text-neutral-900">{application.job?.title}</p>
            </div>
          </div>

          <div>
            <label className="field-label">Round</label>
            <select name="round" required className="field-input">
              <option value="L1">Round 1 — Technical Screening</option>
              <option value="L2">Round 2 — System Design</option>
              <option value="L3">Round 3 — Behavioral</option>
              <option value="final">Final Round</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Date</label>
              <input type="date" name="date" required min={new Date().toISOString().split('T')[0]} className="field-input" />
            </div>
            <div>
              <label className="field-label">Time</label>
              <input type="time" name="time" required className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Duration</label>
              <select name="duration" required className="field-input">
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>
            <div>
              <label className="field-label">Mode</label>
              <select name="mode" required className="field-input">
                <option value="online">Video Call</option>
                <option value="in_person">In-Person</option>
                <option value="phone">Phone</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Location / Meeting Link</label>
            <input type="text" name="location" placeholder="Office address or leave blank" className="field-input" />
          </div>
          <div>
            <label className="field-label">Custom Meeting Link <span className="font-normal text-neutral-400">(optional)</span></label>
            <input type="url" name="meetingLink" placeholder="https://meet.google.com/… (auto-generated if empty)" className="field-input" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" loading={loading} className="flex-1">
              Schedule Interview
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function ApplicationDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const user     = useAuthStore((state) => state.user);
  const isEmployer = user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin';

  const [app, setApp]                 = useState<ApplicationDetail | null>(null);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState(false);
  const [activeTab, setActiveTab]     = useState<ActiveTab>('overview');
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/applications/${id}`);
      const d   = res.data;
      setApp({
        _id:      d._id,
        job:      { _id: d.jobId?._id || d.jobId, title: d.jobId?.title || 'N/A', location: d.jobId?.location },
        candidate: d.candidateId ? {
          _id: d.candidateId._id, firstName: d.candidateId.firstName,
          lastName: d.candidateId.lastName, email: d.candidateId.email, phone: d.candidateId.phone,
        } : undefined,
        status:              d.status,
        coverLetter:         d.coverLetter,
        resume:              d.resumeUrl,
        skillMatchScore:     d.skillMatchScore,
        experienceMatchScore:d.experienceMatchScore,
        overallScore:        d.overallScore,
        appliedAt:           d.createdAt || d.appliedAt,
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await apiClient.put(`/applications/${id}/status`, { status: newStatus });
      toast.success('Status updated');
      await fetchDetail();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <SkeletonPage />;
  if (!app) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-h2 text-neutral-900 mb-4">Application not found</h2>
        <Button variant="secondary" onClick={() => navigate('/applications')}>← Back</Button>
      </div>
    );
  }

  const candidateName = app.candidate
    ? `${app.candidate.firstName} ${app.candidate.lastName}`
    : 'Candidate';

  const STATUSES = ['shortlisted','interview_scheduled','in_progress','selected','hired','offer_released','rejected','on_hold'];
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'resume',   label: 'Resume' },
    { id: 'notes',    label: 'Notes' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/applications')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Applications
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left sidebar ──────────────────────────────────── */}
        <aside className="w-full lg:w-72 space-y-4 shrink-0">
          {/* Candidate card */}
          <div className="card card-md text-center">
            <Avatar name={isEmployer ? candidateName : app.job.title} size="xl" className="mx-auto mb-3" />
            <h2 className="text-h3 text-neutral-900">
              {isEmployer ? candidateName : app.job.title}
            </h2>
            {isEmployer && app.candidate && (
              <p className="text-sm text-neutral-500 mt-0.5">{app.candidate.email}</p>
            )}
            {isEmployer && app.candidate?.phone && (
              <p className="text-sm text-neutral-500">{app.candidate.phone}</p>
            )}

            <div className="mt-3 flex justify-center">
              <StatusBadge status={app.status} />
            </div>

            <div className="mt-4 text-left space-y-2 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Position</span>
                <span className="text-xs font-medium text-neutral-800 truncate max-w-[140px]">{app.job.title}</span>
              </div>
              {app.job.location && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Location</span>
                  <span className="text-xs font-medium text-neutral-800">{app.job.location}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Applied</span>
                <span className="text-xs font-medium text-neutral-800">
                  {new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Match scores */}
          {isEmployer && (app.skillMatchScore !== undefined || app.overallScore !== undefined) && (
            <div className="card card-md">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Match Scores</h3>
              <div className="flex justify-around">
                {app.overallScore !== undefined && (
                  <ScoreRing value={app.overallScore} label="Overall" color="stroke-primary-500" />
                )}
                {app.skillMatchScore !== undefined && (
                  <ScoreRing value={app.skillMatchScore} label="Skills" color="stroke-info-500" />
                )}
                {app.experienceMatchScore !== undefined && (
                  <ScoreRing value={app.experienceMatchScore} label="Experience" color="stroke-success-500" />
                )}
              </div>
            </div>
          )}

          {/* Employer actions */}
          {isEmployer && (
            <div className="card card-md space-y-3">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</h3>

              {['applied','shortlisted'].includes(app.status) && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setShowSchedule(true)}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                >
                  Schedule Interview
                </Button>
              )}

              <div>
                <p className="text-xs text-neutral-500 mb-2">Update Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
                      disabled={updating || app.status === s}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                        app.status === s
                          ? 'bg-primary-50 border-primary-200 text-primary-700 cursor-default'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40'
                      }`}
                    >
                      {s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-neutral-100">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === t.id
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6">
              {/* Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  {isEmployer && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2">Applicant Summary</h3>
                      {app.candidate ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Name',  value: `${app.candidate.firstName} ${app.candidate.lastName}` },
                            { label: 'Email', value: app.candidate.email },
                            { label: 'Phone', value: app.candidate.phone ?? '—' },
                          ].map((f) => (
                            <div key={f.label} className="p-3 bg-neutral-50 rounded-md">
                              <p className="text-xs text-neutral-500">{f.label}</p>
                              <p className="text-sm font-medium text-neutral-900 mt-0.5 truncate">{f.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">Candidate info not available</p>
                      )}
                    </div>
                  )}

                  {app.coverLetter ? (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2">Cover Letter</h3>
                      <div className="p-4 bg-neutral-50 rounded-md text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                        {app.coverLetter}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-neutral-50 rounded-md text-center">
                      <p className="text-sm text-neutral-400">No cover letter provided</p>
                    </div>
                  )}
                </div>
              )}

              {/* Resume tab */}
              {activeTab === 'resume' && (
                <div className="space-y-4 animate-fade-in">
                  {app.resume ? (
                    <>
                      <div className="flex items-center gap-3">
                        <a
                          href={app.resume}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="btn btn-md btn-primary"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Resume
                        </a>
                        <a
                          href={app.resume}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-md btn-secondary"
                        >
                          Open in new tab ↗
                        </a>
                      </div>

                      {isEmployer && app.resume.toLowerCase().endsWith('.pdf') && (
                        <div className="border border-neutral-200 rounded-lg overflow-hidden">
                          <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex items-center gap-2">
                            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs text-neutral-500 font-medium">Resume Preview</span>
                          </div>
                          <iframe src={app.resume} className="w-full h-[500px]" title="Resume Preview" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <svg className="w-10 h-10 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium text-neutral-500">No resume uploaded</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes tab */}
              {activeTab === 'notes' && (
                <div className="animate-fade-in">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <svg className="w-10 h-10 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <p className="text-sm font-medium text-neutral-500">Notes coming soon</p>
                    <p className="text-xs text-neutral-400 mt-1">Collaborative notes will appear here.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* View job link */}
          <div className="flex gap-3">
            <Link to={`/jobs/${app.job._id}`} className="btn btn-sm btn-secondary">
              View Job Posting →
            </Link>
            {isEmployer && (
              <Link to="/interviews" className="btn btn-sm btn-secondary">
                View Interviews →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Schedule modal */}
      {showSchedule && (
        <ScheduleModal
          application={app}
          user={user}
          onClose={() => setShowSchedule(false)}
          onScheduled={fetchDetail}
        />
      )}
    </div>
  );
}
