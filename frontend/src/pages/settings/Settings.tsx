import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import PipelineStagesConfig from './PipelineStagesConfig';
import IntegrationsConfig from './IntegrationsConfig';

type Section = 'profile' | 'pipeline' | 'notifications' | 'integrations';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile', label: 'Company Profile', icon: '🏢' },
  { id: 'pipeline', label: 'Pipeline Stages', icon: '📊' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
];

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Media', 'Telecom', 'Real Estate', 'Other',
];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export default function Settings() {
  const [section, setSection] = useState<Section>('profile');

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage your company settings, branding, and integrations.</p>

      <div className="mt-6 flex gap-6">
        {/* Left nav */}
        <nav className="w-56 shrink-0 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={clsx(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                section === s.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
              )}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {section === 'profile' && <ProfileSection />}
          {section === 'pipeline' && <PipelineStagesConfig />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'integrations' && <IntegrationsConfig />}
        </div>
      </div>
    </div>
  );
}

/* ── Profile Section ────────────────────────────────────────────── */
function ProfileSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => apiClient.get('/companies/settings').then(r => r.data.data),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Sync form when data loads
  const initialized = data && !form._init;
  if (initialized) {
    setForm({
      _init: true,
      name: data.name || '',
      website: data.website || '',
      industry: data.industry || '',
      size: data.size || '',
      primaryColor: data.branding?.primaryColor || '#4f46e5',
    });
    if (data.branding?.logoUrl) setLogoPreview(data.branding.logoUrl);
  }

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => apiClient.patch('/companies/settings', payload),
    onSuccess: () => {
      toast.success('Company profile updated');
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const brandingMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => apiClient.patch('/companies/branding', payload),
    onSuccess: () => {
      toast.success('Branding updated');
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: () => toast.error('Failed to update branding'),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('logo', file);
      return apiClient.post('/companies/branding/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      setLogoPreview(res.data.data.logoUrl);
      toast.success('Logo uploaded');
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: () => toast.error('Failed to upload logo'),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    setLogoPreview(URL.createObjectURL(file));
    logoMutation.mutate(file);
  };

  const handleSave = () => {
    const { name, website, industry, size, primaryColor } = form;
    updateMutation.mutate({ name, website, industry, size });
    if (primaryColor !== data?.branding?.primaryColor) {
      brandingMutation.mutate({ primaryColor });
    }
  };

  if (isLoading) return <div className="animate-pulse h-64 bg-neutral-100 rounded-xl" />;

  return (
    <div className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Company Profile</h2>

      {/* Logo upload */}
      <div>
        <label className="field-label">Company Logo</label>
        <div className="mt-2 flex items-center gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-neutral-200" />
          ) : (
            <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 text-xs">
              No logo
            </div>
          )}
          <label className="btn btn-secondary cursor-pointer text-sm">
            Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Company Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
        <Input label="Website" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Industry</label>
          <select className="field-input mt-1" value={form.industry || ''} onChange={e => setForm({ ...form, industry: e.target.value })}>
            <option value="">Select industry</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Company Size</label>
          <select className="field-input mt-1" value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })}>
            <option value="">Select size</option>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Brand color */}
      <div>
        <label className="field-label">Primary Brand Colour</label>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="color"
            value={form.primaryColor || '#4f46e5'}
            onChange={e => setForm({ ...form, primaryColor: e.target.value })}
            className="w-10 h-10 rounded-lg border border-neutral-200 cursor-pointer"
          />
          <Input
            value={form.primaryColor || '#4f46e5'}
            onChange={e => setForm({ ...form, primaryColor: e.target.value })}
            className="w-32"
            placeholder="#4f46e5"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

/* ── Notifications Section ──────────────────────────────────────── */
function NotificationsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => apiClient.get('/companies/settings').then(r => r.data.data),
  });

  const [notifs, setNotifs] = useState<Record<string, boolean> | null>(null);

  if (data && !notifs) {
    setNotifs({
      emailOnNewApplication: data.notifications?.emailOnNewApplication ?? true,
      emailOnStageChange: data.notifications?.emailOnStageChange ?? true,
      smsEnabled: data.notifications?.smsEnabled ?? false,
    });
  }

  const mutation = useMutation({
    mutationFn: (notifications: Record<string, boolean>) =>
      apiClient.patch('/companies/settings', { notifications }),
    onSuccess: () => {
      toast.success('Notification preferences saved');
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  if (isLoading) return <div className="animate-pulse h-48 bg-neutral-100 rounded-xl" />;

  const toggle = (key: string) => setNotifs(prev => prev ? { ...prev, [key]: !prev[key] } : prev);

  return (
    <div className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Notification Preferences</h2>

      <div className="space-y-4">
        <ToggleRow label="Email me when new applications arrive" checked={!!notifs?.emailOnNewApplication} onChange={() => toggle('emailOnNewApplication')} />
        <ToggleRow label="Email me when candidate stage changes" checked={!!notifs?.emailOnStageChange} onChange={() => toggle('emailOnStageChange')} />
        <ToggleRow label="SMS notifications" checked={!!notifs?.smsEnabled} onChange={() => toggle('smsEnabled')} disabled hint="Requires SMS_API_KEY to be configured" />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => notifs && mutation.mutate(notifs)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange: () => void; disabled?: boolean; hint?: string;
}) {
  return (
    <label className={clsx('flex items-center justify-between py-2', disabled && 'opacity-50')}>
      <div>
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={clsx(
          'relative w-10 h-5 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-neutral-300',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
          checked && 'translate-x-5'
        )} />
      </button>
    </label>
  );
}
