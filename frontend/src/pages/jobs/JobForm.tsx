import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface JobFormData {
  title:         string;
  description:   string;
  location:      string;
  jobType:       string;
  workMode:      string;
  experienceMin: number;
  experienceMax: number;
  salaryMin:     number;
  salaryMax:     number;
  currency:      string;
  skills:        string[];
  requirements:  string[];
}

const EMPTY: JobFormData = {
  title: '', description: '', location: '',
  jobType: 'full_time', workMode: 'onsite',
  experienceMin: 0, experienceMax: 5,
  salaryMin: 0, salaryMax: 0, currency: 'INR',
  skills: [], requirements: [],
};

type Step = 1 | 2 | 3;

/* ── Step progress bar ──────────────────────────────────────────── */
const STEPS = [
  { n: 1 as Step, label: 'Basics',       desc: 'Title, location, type' },
  { n: 2 as Step, label: 'Details',      desc: 'Description, salary, experience' },
  { n: 3 as Step, label: 'Requirements', desc: 'Skills & requirements' },
];

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          {/* Step circle */}
          <div className="flex flex-col items-center">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
              current === s.n  ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
              current > s.n    ? 'bg-success-500 text-white' :
                                 'bg-neutral-100 text-neutral-400',
            )}>
              {current > s.n ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : s.n}
            </div>
            <div className="mt-1.5 hidden sm:block text-center">
              <p className={clsx('text-xs font-semibold', current >= s.n ? 'text-neutral-900' : 'text-neutral-400')}>
                {s.label}
              </p>
              <p className="text-[10px] text-neutral-400 leading-tight">{s.desc}</p>
            </div>
          </div>
          {/* Connector */}
          {i < STEPS.length - 1 && (
            <div className={clsx(
              'flex-1 h-px mx-2 mt-[-14px] sm:mt-[-28px] transition-colors',
              current > s.n ? 'bg-success-400' : 'bg-neutral-200',
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Tag input ──────────────────────────────────────────────────── */
function TagInput({
  label, placeholder, tags, onAdd, onRemove, hint,
}: {
  label: string; placeholder: string; tags: string[];
  onAdd: (v: string) => void; onRemove: (v: string) => void; hint?: string;
}) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim();
    if (t && !tags.includes(t)) { onAdd(t); setVal(''); }
  };
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700 block mb-1.5">{label}</label>
      <div className="flex gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" size="md" onClick={add} className="shrink-0">
          Add
        </Button>
      </div>
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
              {t}
              <button
                type="button"
                onClick={() => onRemove(t)}
                className="ml-0.5 hover:text-primary-900 leading-none"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Review row ──────────────────────────────────────────────────── */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-neutral-100 last:border-0">
      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider w-32 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-neutral-800 flex-1">{value || <span className="text-neutral-400 italic">Not set</span>}</span>
    </div>
  );
}

/* ── Main wizard ────────────────────────────────────────────────── */
export default function JobForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const user     = useAuthStore((state) => state.user);
  const isEdit   = !!id;

  const [step, setStep]       = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [data, setData]       = useState<JobFormData>(EMPTY);
  const [errors, setErrors]   = useState<Partial<Record<keyof JobFormData, string>>>({});

  /* ── Load for edit ─────────────────────────────────────────── */
  useEffect(() => {
    if (!isEdit) return;
    setFetching(true);
    apiClient.get(`/jobs/${id}`)
      .then((res) => {
        const j = res.data as any;
        setData({
          title:         j.title        || '',
          description:   j.description  || '',
          location:      j.location     || '',
          jobType:       j.jobType      || 'full_time',
          workMode:      j.workMode     || 'onsite',
          experienceMin: j.experienceMin ?? 0,
          experienceMax: j.experienceMax ?? 5,
          salaryMin:     j.salaryMin    ?? 0,
          salaryMax:     j.salaryMax    ?? 0,
          currency:      j.currency     || 'INR',
          skills:        j.skills       || [],
          requirements:  j.requirements || [],
        });
      })
      .catch(() => toast.error('Failed to load job details'))
      .finally(() => setFetching(false));
  }, [id]);

  /* ── Per-step validation ────────────────────────────────────── */
  function validateStep(s: Step): boolean {
    const e: Partial<Record<keyof JobFormData, string>> = {};
    if (s === 1) {
      if (!data.title.trim())    e.title    = 'Job title is required';
      if (!data.location.trim()) e.location = 'Location is required';
    }
    if (s === 2) {
      if (!data.description.trim()) e.description = 'Description is required';
      if (data.experienceMax < data.experienceMin)
        e.experienceMax = 'Max experience must be ≥ min';
      if (data.salaryMin > 0 && data.salaryMax > 0 && data.salaryMax < data.salaryMin)
        e.salaryMax = 'Max salary must be ≥ min salary';
    }
    if (s === 3) {
      if (data.skills.length === 0) e.skills = 'Add at least one skill';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(3, s + 1) as Step);
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  function set<K extends keyof JobFormData>(k: K, v: JobFormData[K]) {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => { const next = { ...e }; delete next[k]; return next; });
  }

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    try {
      setLoading(true);
      if (isEdit) {
        await apiClient.put(`/jobs/${id}`, data);
        toast.success('Job updated successfully!');
      } else {
        await apiClient.post('/jobs', data);
        toast.success('Job posted successfully!');
      }
      navigate('/jobs');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${isEdit ? 'update' : 'post'} job`);
    } finally {
      setLoading(false);
    }
  };

  /* ── Access guard ───────────────────────────────────────────── */
  if (!['employer', 'admin', 'hr'].includes(user?.role ?? '')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-h2 text-neutral-900 mb-2">Access Denied</h2>
        <p className="text-neutral-500">Only employers and HR can post jobs.</p>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </button>

      <h1 className="page-title mb-6">{isEdit ? 'Edit Job' : 'Post New Job'}</h1>

      {/* Progress stepper */}
      <StepBar current={step} />

      {/* ── Step 1: Basics ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="card card-md space-y-5 animate-fade-in">
          <div>
            <h2 className="text-h3 mb-0.5">Basic Information</h2>
            <p className="text-sm text-neutral-500">What role are you hiring for?</p>
          </div>

          <Input
            label="Job Title"
            required
            value={data.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Senior Full Stack Developer"
            error={errors.title}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location"
              required
              value={data.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Bangalore, India"
              error={errors.location}
            />
            <Select
              label="Work Mode"
              value={data.workMode}
              onChange={(e) => set('workMode', e.target.value)}
            >
              <option value="onsite">On-site</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </div>

          <Select
            label="Employment Type"
            value={data.jobType}
            onChange={(e) => set('jobType', e.target.value)}
          >
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="temporary">Temporary</option>
          </Select>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={next}>
              Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Details ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="card card-md space-y-5 animate-fade-in">
          <div>
            <h2 className="text-h3 mb-0.5">Role Details</h2>
            <p className="text-sm text-neutral-500">Describe the position and compensation.</p>
          </div>

          <Textarea
            label="Job Description"
            required
            value={data.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe the role, responsibilities, and team environment…"
            rows={6}
            error={errors.description}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Experience (years)"
              type="number"
              min={0}
              value={data.experienceMin || ''}
              onChange={(e) => set('experienceMin', e.target.value === '' ? 0 : parseInt(e.target.value))}
            />
            <Input
              label="Max Experience (years)"
              type="number"
              min={0}
              value={data.experienceMax || ''}
              onChange={(e) => set('experienceMax', e.target.value === '' ? 0 : parseInt(e.target.value))}
              error={errors.experienceMax}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Min Salary"
              type="number"
              min={0}
              value={data.salaryMin || ''}
              onChange={(e) => set('salaryMin', e.target.value === '' ? 0 : parseInt(e.target.value))}
              hint="Leave 0 to hide"
            />
            <Input
              label="Max Salary"
              type="number"
              min={0}
              value={data.salaryMax || ''}
              onChange={(e) => set('salaryMax', e.target.value === '' ? 0 : parseInt(e.target.value))}
              error={errors.salaryMax}
            />
            <Select
              label="Currency"
              value={data.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={back}>← Back</Button>
            <Button variant="primary" onClick={next}>
              Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Requirements + Review ───────────────────────── */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <div className="card card-md space-y-5">
            <div>
              <h2 className="text-h3 mb-0.5">Requirements</h2>
              <p className="text-sm text-neutral-500">What skills and qualifications are needed?</p>
            </div>

            <div>
              <TagInput
                label="Required Skills *"
                placeholder="e.g. React, Node.js, PostgreSQL — press Enter to add"
                tags={data.skills}
                onAdd={(v) => set('skills', [...data.skills, v])}
                onRemove={(v) => set('skills', data.skills.filter((s) => s !== v))}
                hint="Add at least one skill"
              />
              {errors.skills && (
                <p className="text-xs text-error-600 mt-1" role="alert">{errors.skills}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">
                Job Requirements
                <span className="font-normal text-neutral-400 ml-1">(optional)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  id="req-input"
                  placeholder="e.g. Bachelor's in Computer Science — press Enter to add"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = document.getElementById('req-input') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val) { set('requirements', [...data.requirements, val]); input.value = ''; }
                    }
                  }}
                />
                <Button
                  type="button" variant="secondary" size="md"
                  onClick={() => {
                    const input = document.getElementById('req-input') as HTMLInputElement;
                    const val = input.value.trim();
                    if (val) { set('requirements', [...data.requirements, val]); input.value = ''; }
                  }}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
              {data.requirements.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {data.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 group">
                      <span className="text-neutral-300 mt-0.5">•</span>
                      <span className="flex-1">{r}</span>
                      <button
                        type="button"
                        onClick={() => set('requirements', data.requirements.filter((_, j) => j !== i))}
                        className="text-neutral-300 hover:text-error-500 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Review summary */}
          <div className="card card-md">
            <h3 className="text-h3 mb-4">Review</h3>
            <ReviewRow label="Title"      value={data.title} />
            <ReviewRow label="Location"   value={`${data.location} · ${data.workMode}`} />
            <ReviewRow label="Type"       value={data.jobType.replace('_', ' ')} />
            <ReviewRow label="Experience" value={`${data.experienceMin}–${data.experienceMax} years`} />
            <ReviewRow label="Salary"     value={
              data.salaryMin || data.salaryMax
                ? `${data.currency} ${(data.salaryMin/100000).toFixed(1)}L – ${(data.salaryMax/100000).toFixed(1)}L`
                : 'Not specified'
            } />
            <ReviewRow label="Skills" value={
              data.skills.length > 0
                ? <div className="flex flex-wrap gap-1">{data.skills.map((s) => <Badge key={s} variant="purple">{s}</Badge>)}</div>
                : undefined
            } />
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={back}>← Back</Button>
            <Button variant="primary" loading={loading} onClick={handleSubmit}>
              {isEdit ? 'Save Changes' : 'Post Job'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
