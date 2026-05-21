import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore }   from '../../store/authStore';
import apiClient          from '../../services/api';
import { StatusBadge }    from '../../components/ui/Badge';
import { Avatar }         from '../../components/ui/Avatar';
import { Button }         from '../../components/ui/Button';
import { SkeletonPage }   from '../../components/ui/Skeleton';
import { ConfirmDialog }  from '../../components/ui/ConfirmDialog';
import ProctoringReport   from '../proctoring/ProctoringReport';
import { NotesTab }        from './tabs/NotesTab';
import { TimelineTab }     from './tabs/TimelineTab';
import { toast }          from 'sonner';

// ─── Local types ──────────────────────────────────────────────────────────────

interface AppDetail {
  _id:      string;
  job:      { _id: string; title: string; location?: string };
  candidate?: { _id?: string; firstName: string; lastName: string; email: string; phone?: string };
  status:           string;
  coverLetter?:     string;
  resume?:          string;
  skillMatchScore?:     number;
  experienceMatchScore?:number;
  overallScore?:        number;
  appliedAt:        string;

  // Parsed resume
  parsedSkills?:         string[];
  parsedExperienceYears?:number;
  parsedEducation?:      { degree: string; institution: string }[];
  parsedNoticePeriod?:   string;
  parsedAt?:             string;

  // AI ranking
  missingSkills?:  string[];
  matchingSkills?: string[];
}

type ActiveTab = 'overview' | 'resume' | 'notes' | 'timeline' | 'proctoring';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ value, label, color = 'stroke-primary-500' }: { value: number; label: string; color?: string }) {
  const r    = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" className="stroke-neutral-100" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4"
          className={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs text-neutral-900 font-semibold -mt-12 pointer-events-none" aria-hidden="true">{value}%</span>
      <span className="text-[10px] text-neutral-500 mt-7 text-center leading-tight">{label}</span>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 font-medium">{label}</span>
        <span className={`font-bold tabular-nums ${pct >= 70 ? 'text-success-700' : pct >= 40 ? 'text-warning-700' : 'text-error-700'}`}>
          {pct}<span className="font-normal text-neutral-400">/100</span>
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${label}: ${pct} out of 100`}
      >
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Schedule Interview Modal ─────────────────────────────────── */
function ScheduleModal({
  application, user, onClose, onScheduled,
}: {
  application: AppDetail;
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
        duration:    parseInt(fd.get('duration') as string) || 60,
        mode:        fd.get('mode'),
        location:    fd.get('location') || '',
        meetingLink: fd.get('meetingLink') || 'https://meet.google.com/' + Math.random().toString(36).substring(7),
        round:       fd.get('round'),
        panel:       [{ userId: user?._id, name: `${user?.firstName} ${user?.lastName}`, email: user?.email, role: user?.role }],
      });
      toast.success('Interview scheduled!');
      onScheduled();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-h3">Schedule Interview</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1 rounded">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Round</label>
                <select name="round" className="field-input" defaultValue="L1">
                  {['L1', 'L2', 'L3', 'HR', 'technical', 'managerial'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Mode</label>
                <select name="mode" className="field-input" defaultValue="online">
                  {['online', 'onsite', 'hybrid'].map(m => (
                    <option key={m} value={m} className="capitalize">{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Date</label>
                <input type="date" name="date" required className="field-input"
                  min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="field-label">Time</label>
                <input type="time" name="time" required className="field-input" defaultValue="10:00" />
              </div>
            </div>
            <div>
              <label className="field-label">Duration (minutes)</label>
              <select name="duration" className="field-input" defaultValue="60">
                {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Location / Meeting Link</label>
              <input type="text" name="location" placeholder="Office or leave blank" className="field-input" />
            </div>
            <div>
              <label className="field-label">Custom Meeting Link <span className="font-normal text-neutral-400">(optional)</span></label>
              <input type="url" name="meetingLink" placeholder="https://meet.google.com/… (auto-generated)" className="field-input" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
              <Button type="submit" variant="primary" loading={loading} className="flex-1">Schedule Interview</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Parsed Resume Section ────────────────────────────────────────────────────

function ParsedResumeSection({ app, onParsed }: { app: AppDetail; onParsed: () => void }) {
  const [parsing, setParsing] = useState(false);

  const handleParse = async () => {
    setParsing(true);
    try {
      await apiClient.post(`/applications/${app._id}/parse-resume`);
      toast.success('Resume parsed successfully');
      onParsed();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to parse resume');
    } finally {
      setParsing(false);
    }
  };

  const isParsed = !!app.parsedAt;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          Parsed Resume
          {isParsed && (
            <span className="text-[10px] font-medium text-neutral-400">
              Last parsed {formatDistanceToNow(new Date(app.parsedAt!), { addSuffix: true })}
            </span>
          )}
        </h3>
        {app.resume && (
          <Button
            variant="ghost"
            size="sm"
            loading={parsing}
            onClick={handleParse}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          >
            {isParsed ? 'Re-parse' : 'Parse Resume'}
          </Button>
        )}
      </div>

      {!isParsed ? (
        <div className="p-4 bg-neutral-50 rounded-lg text-center">
          {app.resume ? (
            <p className="text-sm text-neutral-500">
              Click <strong>Parse Resume</strong> to extract skills and experience using AI.
            </p>
          ) : (
            <p className="text-sm text-neutral-400">No resume uploaded — candidate has not submitted a resume file.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Skills */}
          {app.parsedSkills && app.parsedSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Extracted Skills</p>
              <div className="flex flex-wrap gap-1.5" role="list" aria-label="Extracted skills">
                {app.parsedSkills.map(skill => (
                  <span
                    key={skill}
                    role="listitem"
                    className="px-2.5 py-1 bg-primary-50 border border-primary-100 text-primary-700 rounded-md text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience + notice period */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {app.parsedExperienceYears != null && (
              <div className="p-3 bg-neutral-50 rounded-md">
                <p className="text-xs text-neutral-500">Experience</p>
                <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {app.parsedExperienceYears} {app.parsedExperienceYears === 1 ? 'year' : 'years'}
                </p>
              </div>
            )}
            {app.parsedNoticePeriod && (
              <div className="p-3 bg-neutral-50 rounded-md">
                <p className="text-xs text-neutral-500">Notice Period</p>
                <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.parsedNoticePeriod}</p>
              </div>
            )}
          </div>

          {/* Education */}
          {app.parsedEducation && app.parsedEducation.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Education</p>
              <ul className="space-y-1.5" aria-label="Education history">
                {app.parsedEducation.map((edu, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-neutral-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    <span>
                      <span className="font-medium text-neutral-800">{edu.degree}</span>
                      {edu.institution && <span className="text-neutral-500"> · {edu.institution}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Fit Analysis Section ──────────────────────────────────────────────────

function AIFitSection({ app }: { app: AppDetail }) {
  const hasScores = app.skillMatchScore != null || app.experienceMatchScore != null || app.overallScore != null;
  if (!hasScores) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">AI Fit Analysis</h3>
      <div className="space-y-3 p-4 bg-neutral-50 rounded-lg">
        {app.skillMatchScore != null && (
          <ScoreBar label="Skill Match" value={app.skillMatchScore} color="bg-info-500" />
        )}
        {app.experienceMatchScore != null && (
          <ScoreBar label="Experience Fit" value={app.experienceMatchScore} color="bg-success-500" />
        )}
        {app.overallScore != null && (
          <ScoreBar label="Overall Fit" value={app.overallScore} color="bg-primary-500" />
        )}
      </div>

      {/* Skill gaps */}
      {app.missingSkills && app.missingSkills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-error-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Gap skills
          </p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Missing skills">
            {app.missingSkills.map(s => (
              <span key={s} role="listitem"
                className="px-2.5 py-1 bg-error-50 border border-error-100 text-error-700 rounded-md text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Matching skills */}
      {app.matchingSkills && app.matchingSkills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-success-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Matching skills
          </p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Matching skills">
            {app.matchingSkills.map(s => (
              <span key={s} role="listitem"
                className="px-2.5 py-1 bg-success-50 border border-success-100 text-success-700 rounded-md text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const user       = useAuthStore(s => s.user);
  const isEmployer = user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin';

  const [app, setApp]               = useState<AppDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(false);
  const [activeTab, setActiveTab]   = useState<ActiveTab>('overview');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/applications/${id}`);
      const d   = res.data;
      setApp({
        _id:       d._id,
        job:       { _id: d.jobId?._id || d.jobId, title: d.jobId?.title || 'N/A', location: d.jobId?.location },
        candidate: d.candidateId ? {
          _id: d.candidateId._id, firstName: d.candidateId.firstName,
          lastName: d.candidateId.lastName, email: d.candidateId.email, phone: d.candidateId.phone,
        } : undefined,
        status:               d.status,
        coverLetter:          d.coverLetter,
        resume:               d.resumeUrl,
        skillMatchScore:      d.skillMatchScore,
        experienceMatchScore: d.experienceMatchScore,
        overallScore:         d.overallScore,
        appliedAt:            d.createdAt || d.appliedAt,

        // Parsed resume
        parsedSkills:          d.parsedSkills,
        parsedExperienceYears: d.parsedExperienceYears,
        parsedEducation:       d.parsedEducation,
        parsedNoticePeriod:    d.parsedNoticePeriod,
        parsedAt:              d.parsedAt,

        // AI ranking
        missingSkills:  d.missingSkills,
        matchingSkills: d.matchingSkills,
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

  if (!app) return (
    <div className="p-6 text-center">
      <h2 className="text-h2 text-neutral-900 mb-4">Application not found</h2>
      <Button variant="secondary" onClick={() => navigate('/applications')}>← Back</Button>
    </div>
  );

  const candidateName = app.candidate
    ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Candidate';

  const STATUSES = ['shortlisted','interview_scheduled','in_progress','selected','hired','offer_released','rejected','on_hold'];
  const tabs = [
    { id: 'overview'   as ActiveTab, label: 'Overview'   },
    { id: 'resume'     as ActiveTab, label: 'Resume'     },
    { id: 'notes'      as ActiveTab, label: 'Notes'      },
    { id: 'timeline'   as ActiveTab, label: 'Timeline'   },
    // Proctoring tab only visible to HR/Admin/Employer
    ...(isEmployer ? [{ id: 'proctoring' as ActiveTab, label: 'Proctoring' }] : []),
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
              {app.parsedExperienceYears != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Experience</span>
                  <span className="text-xs font-medium text-neutral-800">{app.parsedExperienceYears} yr{app.parsedExperienceYears !== 1 ? 's' : ''}</span>
                </div>
              )}
              {app.parsedNoticePeriod && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Notice</span>
                  <span className="text-xs font-medium text-neutral-800 truncate max-w-[110px]">{app.parsedNoticePeriod}</span>
                </div>
              )}
            </div>
          </div>

          {/* Match scores ring display */}
          {isEmployer && (app.skillMatchScore != null || app.overallScore != null) && (
            <div className="card card-md">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Match Scores</h3>
              <div className="flex justify-around">
                {app.overallScore != null && (
                  <ScoreRing value={app.overallScore} label="Overall" color="stroke-primary-500" />
                )}
                {app.skillMatchScore != null && (
                  <ScoreRing value={app.skillMatchScore} label="Skills" color="stroke-info-500" />
                )}
                {app.experienceMatchScore != null && (
                  <ScoreRing value={app.experienceMatchScore} label="Exp." color="stroke-success-500" />
                )}
              </div>
            </div>
          )}

          {/* Employer actions */}
          {isEmployer && (
            <div className="card card-md space-y-3">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</h3>
              {['applied', 'shortlisted'].includes(app.status) && (
                <Button variant="primary" className="w-full" onClick={() => setShowSchedule(true)}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                >
                  Schedule Interview
                </Button>
              )}
              <div>
                <p className="text-xs text-neutral-500 mb-2">Update Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => s === 'rejected' ? setShowRejectConfirm(true) : updateStatus(s)} disabled={updating || app.status === s}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                        app.status === s
                          ? 'bg-primary-50 border-primary-200 text-primary-700 cursor-default'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40'
                      }`}
                    >
                      {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-neutral-100">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
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

              {/* ── OVERVIEW TAB ─────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Applicant summary */}
                  {isEmployer && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2">Applicant Summary</h3>
                      {app.candidate ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Name',  value: `${app.candidate.firstName} ${app.candidate.lastName}` },
                            { label: 'Email', value: app.candidate.email },
                            { label: 'Phone', value: app.candidate.phone ?? '—' },
                          ].map(f => (
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

                  {/* Parsed Resume section (employer only) */}
                  {isEmployer && (
                    <ParsedResumeSection app={app} onParsed={fetchDetail} />
                  )}

                  {/* AI Fit Analysis (employer only) */}
                  {isEmployer && <AIFitSection app={app} />}

                  {/* Cover letter */}
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

              {/* ── RESUME TAB ───────────────────────────────── */}
              {activeTab === 'resume' && (
                <div className="space-y-4 animate-fade-in">
                  {app.resume ? (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <a href={app.resume} target="_blank" rel="noopener noreferrer" download
                          className="btn btn-md btn-primary">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Resume
                        </a>
                        <a href={app.resume} target="_blank" rel="noopener noreferrer"
                          className="btn btn-md btn-secondary">
                          Open in new tab ↗
                        </a>
                      </div>
                      {isEmployer && app.resume.toLowerCase().endsWith('.pdf') && (
                        <div className="border border-neutral-200 rounded-lg overflow-hidden">
                          <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex items-center gap-2">
                            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium text-neutral-500">No resume uploaded</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── NOTES TAB ────────────────────────────────── */}
              {activeTab === 'notes' && (
                <div className="animate-fade-in">
                  <NotesTab applicationId={id!} />
                </div>
              )}

              {/* ── TIMELINE TAB ──────────────────────────────── */}
              {activeTab === 'timeline' && (
                <div className="animate-fade-in">
                  <TimelineTab applicationId={id!} />
                </div>
              )}

              {/* ── PROCTORING TAB ───────────────────────── */}
              {activeTab === 'proctoring' && isEmployer && (
                <div className="animate-fade-in">
                  <ProctoringReport applicationId={id!} />
                </div>
              )}
            </div>
          </div>

          {/* Bottom links */}
          <div className="flex gap-3">
            <Link to={`/jobs/${app.job._id}`} className="btn btn-sm btn-secondary">
              View Job Posting →
            </Link>
            {isEmployer && (
              <>
                <Link to="/interviews" className="btn btn-sm btn-secondary">
                  View Interviews →
                </Link>
                <Link to={`/applications/${app._id}/ai-report`} className="btn btn-sm btn-secondary">
                  AI Report →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Schedule modal */}
      {showSchedule && app && (
        <ScheduleModal
          application={app}
          user={user}
          onClose={() => setShowSchedule(false)}
          onScheduled={fetchDetail}
        />
      )}

      {/* Reject confirmation */}
      <ConfirmDialog
        open={showRejectConfirm}
        title="Reject candidate?"
        message="This will reject the candidate's application. They will be notified of the decision."
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={() => { setShowRejectConfirm(false); updateStatus('rejected'); }}
        onCancel={() => setShowRejectConfirm(false)}
      />
    </div>
  );
}
