/**
 * JobCreateWizard — 4-step job creation form.
 *
 * Step 1: Basics      — title, department, location, type, salary
 * Step 2: Job Details — rich description, required skills, nice-to-haves, about team
 * Step 3: Pipeline    — hiring stage configuration (HTML5 drag-to-reorder)
 * Step 4: Publish     — deadline, portals, visibility, preview → Save Draft / Publish
 *
 * Auto-save: after Step 1 creates a draft, form is auto-saved every 30 s if dirty.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate }    from 'react-router-dom';
import { clsx }           from 'clsx';
import { toast }          from 'sonner';

import apiClient          from '../../services/api';
import { useAuthStore }   from '../../store/authStore';
import { Button }         from '../../components/ui/Button';
import { Badge }          from '../../components/ui/Badge';
import { Input, Select }  from '../../components/ui/Input';
import { TagInput }       from '../../components/form/TagInput';
import { RichTextEditor } from '../../components/form/RichTextEditor';
import { StepProgress }   from '../../components/form/StepProgress';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step1 {
  title:         string;
  department:    string;
  location:      string;
  workMode:      'onsite' | 'hybrid' | 'remote';
  jobType:       string;
  experienceMin: number;
  experienceMax: number;
  salaryMin:     number;
  salaryMax:     number;
  currency:      string;
  hiringManagerId: string;
}

interface Step2 {
  description: string;  // HTML from Tiptap
  skills:      string[];
  requirements:string[];
  aboutTeam:   string;  // HTML from Tiptap
}

interface PipelineStage {
  id:              string;
  name:            string;
  isDefault:       boolean;
  autoAdvanceDays: number;
}

interface Step4 {
  applicationDeadline: string;
  portals:             string[];
  visibility:          'public' | 'internal';
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const D1: Step1 = {
  title: '', department: '', location: '',
  workMode: 'onsite', jobType: 'full_time',
  experienceMin: 0, experienceMax: 5,
  salaryMin: 0, salaryMax: 0, currency: 'INR',
  hiringManagerId: '',
};

const D2: Step2 = { description: '', skills: [], requirements: [], aboutTeam: '' };

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'applied',   name: 'Applied',   isDefault: true,  autoAdvanceDays: 0 },
  { id: 'screening', name: 'Screening', isDefault: true,  autoAdvanceDays: 0 },
  { id: 'interview', name: 'Interview', isDefault: true,  autoAdvanceDays: 0 },
  { id: 'offer',     name: 'Offer',     isDefault: true,  autoAdvanceDays: 0 },
  { id: 'hired',     name: 'Hired',     isDefault: true,  autoAdvanceDays: 0 },
];

const D4: Step4 = { applicationDeadline: '', portals: ['website'], visibility: 'public' };

const WIZARD_STEPS = [
  { id: 1, label: 'Basics',    desc: 'Title, type, salary' },
  { id: 2, label: 'Details',   desc: 'Description, skills' },
  { id: 3, label: 'Pipeline',  desc: 'Hiring stages'       },
  { id: 4, label: 'Publish',   desc: 'Portal & deadline'   },
];

const DEPARTMENTS   = ['Engineering', 'Design', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance', 'Other'];
const PORTALS_LIST  = [
  { id: 'website',  label: 'Company Website' },
  { id: 'naukri',   label: 'Naukri'         },
  { id: 'linkedin', label: 'LinkedIn'       },
  { id: 'github',   label: 'GitHub Jobs'   },
];
const EMAIL_TEMPLATES = ['None', 'Application Received', 'Interview Invitation', 'Offer Letter', 'Rejection'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeSince(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 30)   return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} hr ago`;
}

function stripHtml(html: string): string {
  try {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
  } catch {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

function formatSalary(min: number, max: number, currency: string): string {
  if (!min && !max) return '';
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
  const fmt = (n: number) => {
    if (currency === 'INR') return n >= 100_000 ? `${sym}${(n / 100_000).toFixed(1)}L` : `${sym}${(n / 1000).toFixed(0)}K`;
    return `${sym}${n.toLocaleString()}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)} / yr`;
  if (min) return `From ${fmt(min)} / yr`;
  return `Up to ${fmt(max)} / yr`;
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-h3 text-neutral-900">{title}</h2>
      {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Inline work-mode toggle (on-site / hybrid / remote) ─────────────────────

function WorkModeToggle({ value, onChange }: { value: Step1['workMode']; onChange: (v: Step1['workMode']) => void }) {
  const opts: { v: Step1['workMode']; label: string }[] = [
    { v: 'onsite', label: 'On-site' },
    { v: 'hybrid', label: 'Hybrid'  },
    { v: 'remote', label: 'Remote'  },
  ];
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Remote Policy</label>
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg">
        {opts.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={clsx(
              'flex-1 py-1.5 text-sm font-medium rounded-md transition-all',
              value === o.v
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Radio group for employment type ─────────────────────────────────────────

function RadioGroup<T extends string>({
  label, options, value, onChange,
}: {
  label:   string;
  options: { v: T; label: string }[];
  value:   T;
  onChange:(v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <label key={o.v} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name={label}
              value={o.v}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              className="accent-primary-600 w-4 h-4"
            />
            <span className="text-sm text-neutral-700">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Visibility toggle ────────────────────────────────────────────────────────

function VisibilityToggle({ value, onChange }: { value: 'public' | 'internal'; onChange: (v: 'public' | 'internal') => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Visibility</label>
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg w-fit">
        {(['public', 'internal'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={clsx(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize',
              value === v
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            {v === 'internal' ? 'Internal Only' : 'Public'}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        {value === 'internal' ? 'Only visible to logged-in company users' : 'Visible to all candidates on job portals'}
      </p>
    </div>
  );
}

// ─── Candidate-facing preview card ───────────────────────────────────────────

function JobPreview({ s1, s2 }: { s1: Step1; s2: Step2 }) {
  const descText = useMemo(() => stripHtml(s2.description).slice(0, 280), [s2.description]);
  const salary   = useMemo(() => formatSalary(s1.salaryMin, s1.salaryMax, s1.currency), [s1]);

  return (
    <div className="border border-neutral-200 rounded-xl p-5 bg-neutral-50 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            {s1.title || <span className="italic text-neutral-400">Job Title</span>}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s1.department && <Badge variant="purple">{s1.department}</Badge>}
            <Badge variant="blue">{s1.workMode.charAt(0).toUpperCase() + s1.workMode.slice(1)}</Badge>
            <Badge variant="gray">{s1.jobType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-neutral-500 shrink-0">
          <p className="font-medium">{s1.location || '—'}</p>
          {salary && <p className="text-success-600 font-semibold mt-0.5">{salary}</p>}
        </div>
      </div>

      {s1.experienceMin > 0 || s1.experienceMax > 0 ? (
        <p className="text-xs text-neutral-500">
          Experience: {s1.experienceMin}–{s1.experienceMax} years
        </p>
      ) : null}

      {descText ? (
        <p className="text-sm text-neutral-600 leading-relaxed line-clamp-4">{descText}</p>
      ) : (
        <p className="text-sm text-neutral-400 italic">No description yet</p>
      )}

      {s2.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s2.skills.slice(0, 8).map(s => (
            <span key={s} className="px-2 py-0.5 bg-white border border-neutral-200 rounded text-xs text-neutral-700">{s}</span>
          ))}
          {s2.skills.length > 8 && <span className="text-xs text-neutral-400">+{s2.skills.length - 8} more</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main wizard component ────────────────────────────────────────────────────

export default function JobCreateWizard() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);

  // Step state
  const [step,           setStep]           = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Job ID — obtained when the draft is first created (Step 1 completion)
  const [jobId, setJobId] = useState<string | null>(null);

  // Save status
  const [saveStatus, setSaveStatus] = useState<{
    state: 'idle' | 'saving' | 'saved' | 'error';
    savedAt?: Date;
  }>({ state: 'idle' });

  // Ticker so "2 min ago" label updates without full refetch
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  // Form data
  const [s1,     setS1]     = useState<Step1>(D1);
  const [s2,     setS2]     = useState<Step2>(D2);
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [s4,     setS4]     = useState<Step4>(D4);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading states
  const [loading, setLoading] = useState(false);

  // Hiring managers (admin-only fetch; gracefully ignored if forbidden)
  const [managers, setManagers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!['admin'].includes(user?.role ?? '')) return;
    apiClient.get('/admin/hr-users')
      .then(res => {
        const list = (res.data as any)?.users ?? (res.data as any) ?? [];
        if (Array.isArray(list)) setManagers(list);
      })
      .catch(() => {/* not available — silently ignore */});
  }, [user?.role]);

  // Fetch job templates
  useEffect(() => {
    apiClient.get('/job-templates')
      .then(res => {
        const list = (res.data as any)?.data ?? (res.data as any) ?? [];
        if (Array.isArray(list)) setTemplates(list);
      })
      .catch(() => {/* templates not available */});
  }, []);

  // Dirty tracking via refs (stale-closure safe)
  const isDirtyRef = useRef(false);
  const s1Ref = useRef(s1);
  const s2Ref = useRef(s2);
  const s4Ref = useRef(s4);
  useEffect(() => { s1Ref.current = s1; isDirtyRef.current = true; }, [s1]);
  useEffect(() => { s2Ref.current = s2; isDirtyRef.current = true; }, [s2]);
  useEffect(() => { s4Ref.current = s4; isDirtyRef.current = true; }, [s4]);

  // Pipeline drag state (native HTML5)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // ── Auto-save interval (runs once jobId exists) ──────────────────────────
  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(() => {
      if (isDirtyRef.current) performAutoSave();
    }, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── API helpers ──────────────────────────────────────────────────────────

  const buildPayload = (status: 'draft' | 'published', _s1 = s1, _s2 = s2, _s4 = s4) => ({
    title:         _s1.title.trim(),
    department:    _s1.department,
    location:      _s1.location.trim(),
    workMode:      _s1.workMode,
    jobType:       _s1.jobType,
    experienceMin: _s1.experienceMin,
    experienceMax: _s1.experienceMax,
    salaryMin:     _s1.salaryMin  || undefined,
    salaryMax:     _s1.salaryMax  || undefined,
    currency:      _s1.currency,
    description:   _s2.description,
    skills:        _s2.skills,
    requirements:  _s2.requirements,
    expiryDate:    _s4.applicationDeadline || undefined,
    status,
  });

  const performAutoSave = async () => {
    // Auto-save only when a draft already exists (i.e. after Step 4 first save)
    if (!jobId) return;
    setSaveStatus({ state: 'saving' });
    try {
      await apiClient.put(`/jobs/${jobId}`, buildPayload('draft', s1Ref.current, s2Ref.current, s4Ref.current));
      isDirtyRef.current = false;
      setSaveStatus({ state: 'saved', savedAt: new Date() });
    } catch {
      setSaveStatus({ state: 'error' });
    }
  };

  /**
   * createInitialDraft — called ONLY from the Step 4 final action, never Step 1.
   * At this point all steps are complete so description will be present.
   */
  const createInitialDraft = async (): Promise<string | null> => {
    setSaveStatus({ state: 'saving' });
    try {
      // Use the combined payload from all four steps
      const payload = buildPayload('draft', s1Ref.current, s2Ref.current, s4Ref.current);
      const res     = await apiClient.post('/jobs', payload);
      const job     = (res.data as any);
      const newId   = job?._id ?? job?.job?._id;
      if (newId) {
        setJobId(newId);
        isDirtyRef.current = false;
        setSaveStatus({ state: 'saved', savedAt: new Date() });
        return newId;
      }
      return null;
    } catch (err: any) {
      setSaveStatus({ state: 'error' });
      toast.error(err?.response?.data?.message || 'Could not save draft');
      return null;
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!s1.title.trim() || s1.title.trim().length < 5) e.title = 'Job title must be at least 5 characters';
    if (!s1.department)     e.department = 'Please select a department';
    if (!s1.location.trim()) e.location  = 'Location is required';
    if (s1.experienceMax < s1.experienceMin) e.experienceMax = 'Max experience must be ≥ min';
    if (s1.salaryMin && s1.salaryMax && s1.salaryMax < s1.salaryMin) e.salaryMax = 'Max salary must be ≥ min';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    const descText = stripHtml(s2.description);
    if (!descText || descText.length < 30) e.description = 'Please provide a job description (at least 30 characters)';
    if (s2.skills.length === 0) e.skills = 'Add at least one required skill';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToStep = (target: number) => {
    if (completedSteps.has(target)) {
      setErrors({});
      setStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = async () => {
    // Step 1 & 2: validate locally — NO API call yet.
    // The API is only called at Step 4 (handleFinalAction) once all data is ready.
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;

    setCompletedSteps(prev => new Set([...prev, step]));
    setErrors({});
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Final actions ────────────────────────────────────────────────────────

  const handleFinalAction = async (publish: boolean) => {
    const status = publish ? 'published' : 'draft';
    setLoading(true);
    try {
      if (jobId) {
        await apiClient.put(`/jobs/${jobId}`, buildPayload(status));
      } else {
        await apiClient.post('/jobs', buildPayload(status));
      }
      toast.success(publish ? 'Job published successfully!' : 'Draft saved!');
      navigate('/jobs');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${publish ? 'publish' : 'save'} job`);
    } finally {
      setLoading(false);
    }
  };

  // ── Pipeline drag-and-drop (native HTML5) ────────────────────────────────

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(idx);
  };
  const onDrop = (targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDropIdx(null); return; }
    const updated = [...stages];
    const [removed] = updated.splice(dragIdx, 1);
    updated.splice(targetIdx, 0, removed);
    setStages(updated);
    setDragIdx(null);
    setDropIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDropIdx(null); };

  // ── Save status label ────────────────────────────────────────────────────

  const saveLabel =
    saveStatus.state === 'saving' ? 'Saving…'
    : saveStatus.state === 'error'  ? 'Save failed — will retry'
    : saveStatus.state === 'saved' && saveStatus.savedAt
    ? `Draft saved ${getTimeSince(saveStatus.savedAt)}`
    : '';

  const saveLabelColor =
    saveStatus.state === 'saving' ? 'text-neutral-400'
    : saveStatus.state === 'error'  ? 'text-error-500'
    : 'text-success-600';

  // ── Field helpers ────────────────────────────────────────────────────────

  const u1 = <K extends keyof Step1>(k: K, v: Step1[K]) => {
    setS1(d => ({ ...d, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </button>

      {/* Page title + save status */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="page-title">Post New Job</h1>
        {saveLabel && (
          <span className={clsx('text-xs font-medium flex items-center gap-1', saveLabelColor)}>
            {saveStatus.state === 'saving' && (
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saveLabel}
          </span>
        )}
      </div>

      {/* Step progress */}
      <div className="mb-8">
        <StepProgress
          steps={WIZARD_STEPS}
          currentStep={step}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* ══ STEP 1 — BASICS ══════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="card card-md space-y-5 animate-fade-in">
          <SectionHead title="Basic Information" subtitle="What role are you hiring for?" />

          {/* Template selector */}
          {templates.length > 0 && !jobId && (
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl">
              <label className="block text-xs font-medium text-primary-700 mb-1.5">Start from a template</label>
              <select
                className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                defaultValue=""
                onChange={e => {
                  const t = templates.find((tpl: any) => tpl._id === e.target.value);
                  if (!t) return;
                  setS1(prev => ({
                    ...prev,
                    title: t.title || prev.title,
                    department: t.department || prev.department,
                    location: t.location || prev.location,
                    workMode: t.workMode || prev.workMode,
                    jobType: t.jobType || prev.jobType,
                    experienceMin: t.experienceMin ?? prev.experienceMin,
                    experienceMax: t.experienceMax ?? prev.experienceMax,
                    salaryMin: t.salaryMin ?? prev.salaryMin,
                    salaryMax: t.salaryMax ?? prev.salaryMax,
                    currency: t.currency || prev.currency,
                  }));
                  setS2(prev => ({
                    ...prev,
                    description: t.description || prev.description,
                    skills: t.skills?.length ? t.skills : prev.skills,
                    requirements: t.requirements?.length ? t.requirements : prev.requirements,
                  }));
                  toast.success(`Template "${t.name}" applied`);
                }}
              >
                <option value="">Choose a template…</option>
                {templates.map((t: any) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Job Title"
            required
            value={s1.title}
            onChange={e => u1('title', e.target.value)}
            placeholder="e.g. Senior Full Stack Developer"
            error={errors.title}
            hint="Minimum 5 characters"
          />

          <Select
            label="Department"
            value={s1.department}
            onChange={e => u1('department', e.target.value)}
            error={errors.department}
          >
            <option value="">Select department…</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location"
              required
              value={s1.location}
              onChange={e => u1('location', e.target.value)}
              placeholder="e.g. Bangalore, India"
              error={errors.location}
            />
            <WorkModeToggle value={s1.workMode} onChange={v => u1('workMode', v)} />
          </div>

          <RadioGroup
            label="Employment Type"
            value={s1.jobType}
            onChange={v => u1('jobType', v)}
            options={[
              { v: 'full_time',  label: 'Full-time'  },
              { v: 'part_time',  label: 'Part-time'  },
              { v: 'contract',   label: 'Contract'   },
              { v: 'internship', label: 'Internship' },
            ]}
          />

          {/* Experience */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Experience (yrs)"
              type="number"
              min={0}
              value={s1.experienceMin || ''}
              onChange={e => u1('experienceMin', parseInt(e.target.value) || 0)}
            />
            <Input
              label="Max Experience (yrs)"
              type="number"
              min={0}
              value={s1.experienceMax || ''}
              onChange={e => u1('experienceMax', parseInt(e.target.value) || 0)}
              error={errors.experienceMax}
            />
          </div>

          {/* Salary */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Min Salary"
              type="number"
              min={0}
              value={s1.salaryMin || ''}
              onChange={e => u1('salaryMin', parseInt(e.target.value) || 0)}
              hint="Leave 0 to hide"
            />
            <Input
              label="Max Salary"
              type="number"
              min={0}
              value={s1.salaryMax || ''}
              onChange={e => u1('salaryMax', parseInt(e.target.value) || 0)}
              error={errors.salaryMax}
            />
            <Select
              label="Currency"
              value={s1.currency}
              onChange={e => u1('currency', e.target.value)}
            >
              {['INR', 'USD', 'GBP', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          {/* Hiring manager (admin-only) */}
          {managers.length > 0 && (
            <Select
              label="Hiring Manager"
              value={s1.hiringManagerId}
              onChange={e => u1('hiringManagerId', e.target.value)}
              hint="Optional — assign a primary hiring manager"
            >
              <option value="">Select hiring manager…</option>
              {managers.map(m => (
                <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>
              ))}
            </Select>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={handleNext}
              iconRight={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            >
              Save &amp; Continue
            </Button>
          </div>
        </div>
      )}

      {/* ══ STEP 2 — JOB DETAILS ═════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-md space-y-6">
            <SectionHead title="Job Details" subtitle="Describe the role clearly to attract the right candidates." />

            <RichTextEditor
              label="Job Description"
              content={s2.description}
              onChange={v => { setS2(d => ({ ...d, description: v })); setErrors(e => { const n = { ...e }; delete n.description; return n; }); }}
              placeholder="Describe the role, responsibilities, and day-to-day work…"
              error={errors.description}
              minHeight={200}
              hint="Tip: use headings and bullet lists to improve readability"
            />

            <TagInput
              label="Required Skills &amp; Qualifications"
              hint="Type a skill and press Enter to add"
              tags={s2.skills}
              onChange={tags => { setS2(d => ({ ...d, skills: tags })); setErrors(e => { const n = { ...e }; delete n.skills; return n; }); }}
              placeholder="e.g. React, TypeScript, Node.js…"
              error={errors.skills}
            />

            <TagInput
              label={<>Preferred Skills <span className="text-neutral-400 font-normal">(Nice to have)</span></>}
              hint="Optional — skills that are a bonus but not required"
              tags={s2.requirements}
              onChange={tags => setS2(d => ({ ...d, requirements: tags }))}
              placeholder="e.g. Docker, Kubernetes, AWS…"
            />
          </div>

          <div className="card card-md space-y-4">
            <RichTextEditor
              label={<>About the Team <span className="text-neutral-400 font-normal">(Optional)</span></>}
              content={s2.aboutTeam}
              onChange={v => setS2(d => ({ ...d, aboutTeam: v }))}
              placeholder="Tell candidates what makes your team great…"
              minHeight={120}
            />
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleBack}>← Back</Button>
            <Button
              variant="primary"
              onClick={handleNext}
              iconRight={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ══ STEP 3 — PIPELINE CONFIGURATION ══════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-md">
            <SectionHead
              title="Pipeline Configuration"
              subtitle="Drag to reorder stages. Add custom stages as needed."
            />

            <p className="text-xs text-neutral-400 mb-4 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Drag stages to reorder
            </p>

            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id}
                  draggable
                  onDragStart={onDragStart(idx)}
                  onDragOver={onDragOver(idx)}
                  onDrop={onDrop(idx)}
                  onDragEnd={onDragEnd}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border bg-white transition-all select-none',
                    dragIdx === idx ? 'opacity-40 border-dashed border-neutral-300' : '',
                    dropIdx === idx && dragIdx !== idx ? 'border-primary-400 bg-primary-50' : 'border-neutral-200',
                  )}
                >
                  {/* Drag handle */}
                  <div className="text-neutral-300 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zM8 11a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zM8 17a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                    </svg>
                  </div>

                  {/* Stage number */}
                  <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Stage name */}
                  <input
                    value={stage.name}
                    onChange={e => setStages(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                    className="flex-1 text-sm font-medium text-neutral-900 bg-transparent outline-none border-b border-transparent focus:border-primary-300 py-0.5 transition-colors"
                    placeholder="Stage name"
                  />

                  {/* Email template */}
                  <select
                    value={stage.id}
                    onChange={() => {/* template selection — UI only */}}
                    className="text-xs border border-neutral-200 rounded-md px-2 py-1 text-neutral-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 hidden sm:block"
                    title="Email template for this stage"
                    aria-label="Email template"
                  >
                    {EMAIL_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* Auto-advance */}
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500 shrink-0 hidden md:flex" title="Auto-advance after N days (0 = disabled)">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Auto:
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={stage.autoAdvanceDays}
                      onChange={e => setStages(prev => prev.map((s, i) => i === idx ? { ...s, autoAdvanceDays: parseInt(e.target.value) || 0 } : s))}
                      className="w-10 text-center border border-neutral-200 rounded text-xs px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <span>d</span>
                  </label>

                  {/* Remove (non-default only) */}
                  {!stage.isDefault && (
                    <button
                      type="button"
                      onClick={() => setStages(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-neutral-300 hover:text-error-500 transition-colors shrink-0"
                      aria-label="Remove stage"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add stage */}
            <button
              type="button"
              onClick={() => setStages(prev => [
                ...prev,
                { id: `custom-${Date.now()}`, name: 'New Stage', isDefault: false, autoAdvanceDays: 0 },
              ])}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom stage
            </button>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleBack}>← Back</Button>
            <Button
              variant="primary"
              onClick={handleNext}
              iconRight={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ══ STEP 4 — PUBLISH SETTINGS ════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-md space-y-6">
            <SectionHead title="Publish Settings" subtitle="Choose where to list this job and when applications close." />

            {/* Deadline */}
            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Application Deadline <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input
                id="deadline"
                type="date"
                value={s4.applicationDeadline}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setS4(d => ({ ...d, applicationDeadline: e.target.value }))}
                className="w-full sm:w-56 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-neutral-300 transition-all"
              />
            </div>

            {/* Portals */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Post on Job Portals
              </label>
              <div className="space-y-2">
                {PORTALS_LIST.map(p => (
                  <label key={p.id} className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={s4.portals.includes(p.id)}
                      onChange={e => {
                        const updated = e.target.checked
                          ? [...s4.portals, p.id]
                          : s4.portals.filter(x => x !== p.id);
                        setS4(d => ({ ...d, portals: updated }));
                      }}
                      className="w-4 h-4 rounded accent-primary-600"
                    />
                    <span className="text-sm text-neutral-700">{p.label}</span>
                    {p.id === 'website' && (
                      <Badge variant="green" className="text-xs">Default</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <VisibilityToggle value={s4.visibility} onChange={v => setS4(d => ({ ...d, visibility: v }))} />
          </div>

          {/* Preview panel */}
          <div className="card card-md">
            <h3 className="text-h3 text-neutral-900 mb-3">Candidate Preview</h3>
            <p className="text-xs text-neutral-400 mb-3">
              This is how your job will appear to candidates
            </p>
            <JobPreview s1={s1} s2={s2} />
          </div>

          {/* Final action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleBack}>← Back</Button>
              <button
                type="button"
                onClick={async () => {
                  const name = window.prompt('Template name:');
                  if (!name?.trim()) return;
                  try {
                    await apiClient.post('/job-templates', {
                      name: name.trim(),
                      title: s1.title, department: s1.department, location: s1.location,
                      workMode: s1.workMode, jobType: s1.jobType,
                      experienceMin: s1.experienceMin, experienceMax: s1.experienceMax,
                      salaryMin: s1.salaryMin, salaryMax: s1.salaryMax, currency: s1.currency,
                      description: s2.description, skills: s2.skills, requirements: s2.requirements,
                    });
                    toast.success('Template saved');
                  } catch { toast.error('Failed to save template'); }
                }}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
              >
                Save as Template
              </button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                loading={loading}
                onClick={() => handleFinalAction(false)}
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                loading={loading}
                onClick={() => handleFinalAction(true)}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                }
              >
                Publish Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
