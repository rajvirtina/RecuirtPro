import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Media', 'Telecom', 'Real Estate', 'Other',
];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export default function CompanyProfile() {
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
      customDomain: data.branding?.customDomain || '',
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
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return; }
    setLogoPreview(URL.createObjectURL(file));
    logoMutation.mutate(file);
  };

  const handleSave = () => {
    const { name, website, size, primaryColor, customDomain } = form;
    // If user typed a custom industry, strip the 'Other:' prefix before saving
    const industry = form.industry?.startsWith('Other:')
      ? form.industry.slice(6).trim() || 'Other'
      : form.industry;
    updateMutation.mutate({ name, website, industry, size });
    if (
      primaryColor !== data?.branding?.primaryColor ||
      customDomain !== (data?.branding?.customDomain || '')
    ) {
      brandingMutation.mutate({ primaryColor, customDomain: customDomain || undefined });
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
            <img
              src={logoPreview}
              alt="Logo"
              className="w-16 h-16 object-contain rounded-lg border border-neutral-200"
            />
          ) : (
            <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 text-xs">
              No logo
            </div>
          )}
          <label className="btn btn-secondary cursor-pointer text-sm">
            {logoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
              disabled={logoMutation.isPending}
            />
          </label>
          <p className="text-xs text-neutral-400">PNG, JPG, SVG or WebP · max 2 MB</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Company Name"
          value={form.name || ''}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Website"
          value={form.website || ''}
          onChange={e => setForm({ ...form, website: e.target.value })}
          placeholder="https://"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Industry</label>
          <select
            className="field-input mt-1"
            value={form.industry?.startsWith('Other:') ? 'Other' : (form.industry || '')}
            onChange={e => setForm({ ...form, industry: e.target.value })}
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          {(form.industry === 'Other' || form.industry?.startsWith('Other:')) && (
            <input
              type="text"
              className="field-input mt-2"
              placeholder="Please specify your industry"
              value={form.industry?.startsWith('Other:') ? form.industry.slice(6) : ''}
              onChange={e =>
                setForm({ ...form, industry: e.target.value ? `Other:${e.target.value}` : 'Other' })
              }
              autoFocus
            />
          )}
        </div>
        <div>
          <label className="field-label">Company Size</label>
          <select
            className="field-input mt-1"
            value={form.size || ''}
            onChange={e => setForm({ ...form, size: e.target.value })}
          >
            <option value="">Select size</option>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Brand colour */}
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
          <div
            className="w-24 h-9 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-sm"
            style={{ background: form.primaryColor || '#4f46e5' }}
          >
            Preview
          </div>
        </div>
      </div>

      {/* Custom domain */}
      <div>
        <label className="field-label">Custom Portal Domain</label>
        <p className="text-xs text-neutral-500 mt-0.5 mb-1">
          Set a custom subdomain for your branded candidate portal (e.g. careers.yourcompany.com).
        </p>
        <Input
          value={form.customDomain || ''}
          onChange={e => setForm({ ...form, customDomain: e.target.value })}
          placeholder="careers.yourcompany.com"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || brandingMutation.isPending}
        >
          {updateMutation.isPending || brandingMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
