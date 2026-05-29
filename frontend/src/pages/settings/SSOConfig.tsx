import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import apiClient from '../../services/api';
import { toast } from 'sonner';

interface SSOState {
  enabled: boolean;
  type: 'oidc' | 'saml';
  oidcDiscoveryUrl: string;
  oidcClientId: string;
  oidcClientSecret: string;
  samlEntryPoint: string;
  samlIssuer: string;
  samlCert: string;
  allowedEmailDomains: string;
  defaultRole: 'hr' | 'employer' | 'interviewer';
  oidcClientSecretSet?: boolean;
  samlCertSet?: boolean;
}

const EMPTY: SSOState = {
  enabled: false,
  type: 'oidc',
  oidcDiscoveryUrl: '',
  oidcClientId: '',
  oidcClientSecret: '',
  samlEntryPoint: '',
  samlIssuer: '',
  samlCert: '',
  allowedEmailDomains: '',
  defaultRole: 'hr',
};

export default function SSOConfig() {
  const [form, setForm]     = useState<SSOState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    apiClient.get('/auth/sso/config')
      .then((res) => {
        const d = (res.data as any)?.data ?? {};
        setForm({
          enabled:             d.enabled ?? false,
          type:                d.type ?? 'oidc',
          oidcDiscoveryUrl:    d.oidcDiscoveryUrl ?? '',
          oidcClientId:        d.oidcClientId ?? '',
          oidcClientSecret:    '',
          oidcClientSecretSet: d.oidcClientSecretSet ?? false,
          samlEntryPoint:      d.samlEntryPoint ?? '',
          samlIssuer:          d.samlIssuer ?? '',
          samlCert:            '',
          samlCertSet:         d.samlCertSet ?? false,
          allowedEmailDomains: (d.allowedEmailDomains ?? []).join(', '),
          defaultRole:         d.defaultRole ?? 'hr',
        });
      })
      .catch(() => toast.error('Failed to load SSO configuration'))
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof SSOState, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const domains = form.allowedEmailDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const payload: Record<string, any> = {
        enabled:             form.enabled,
        type:                form.type,
        allowedEmailDomains: domains,
        defaultRole:         form.defaultRole,
      };
      if (form.type === 'oidc') {
        payload.oidcDiscoveryUrl = form.oidcDiscoveryUrl;
        payload.oidcClientId     = form.oidcClientId;
        if (form.oidcClientSecret) payload.oidcClientSecret = form.oidcClientSecret;
      } else {
        payload.samlEntryPoint = form.samlEntryPoint;
        payload.samlIssuer     = form.samlIssuer;
        if (form.samlCert) payload.samlCert = form.samlCert;
      }
      await apiClient.post('/auth/sso/config', payload);
      toast.success('SSO configuration saved');
      setForm((prev) => ({ ...prev, oidcClientSecret: '', samlCert: '' }));
    } catch {
      toast.error('Failed to save SSO configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-6 animate-pulse h-40" />;
  }

  const company = (window as any).__recruitpro_slug ?? '';
  const ssoUrl  = `${window.location.origin.replace(':3000', ':5001')}/api/v1/auth/sso/${company}/initiate`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Single Sign-On (SSO)</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Allow your team to log in using your company's identity provider (Okta, Azure AD, Google Workspace, etc.).
        </p>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          role="switch"
          aria-checked={form.enabled}
          onClick={() => set('enabled', !form.enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.enabled ? 'bg-primary-600' : 'bg-neutral-200'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
        <span className="text-sm font-medium text-neutral-900">Enable SSO</span>
      </label>

      {form.enabled && (
        <>
          {/* Type selector */}
          <div>
            <label className="field-label">SSO Protocol</label>
            <div className="flex gap-3 mt-1">
              {(['oidc', 'saml'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {form.type === 'oidc'
                ? 'OIDC covers Google Workspace, Okta, Azure AD, and any OpenID Connect provider.'
                : 'SAML 2.0 for enterprise identity providers.'}
            </p>
          </div>

          {form.type === 'oidc' ? (
            <div className="space-y-4 p-4 border border-neutral-100 rounded-lg">
              <Input
                label="OIDC Discovery URL"
                value={form.oidcDiscoveryUrl}
                onChange={(e) => set('oidcDiscoveryUrl', e.target.value)}
                placeholder="https://accounts.google.com"
                helperText="The base URL of your IdP (without /.well-known/openid-configuration)"
              />
              <Input
                label="Client ID"
                value={form.oidcClientId}
                onChange={(e) => set('oidcClientId', e.target.value)}
                placeholder="your-client-id"
              />
              <Input
                label={form.oidcClientSecretSet ? 'Client Secret (leave blank to keep existing)' : 'Client Secret'}
                type="password"
                value={form.oidcClientSecret}
                onChange={(e) => set('oidcClientSecret', e.target.value)}
                placeholder={form.oidcClientSecretSet ? '••••••••' : 'your-client-secret'}
              />
              <div className="p-3 bg-neutral-50 rounded-lg text-xs text-neutral-600 space-y-1">
                <p className="font-medium text-neutral-800">Redirect URI to configure in your IdP:</p>
                <code className="block bg-white border border-neutral-200 rounded px-2 py-1 font-mono break-all">
                  {ssoUrl.replace('/initiate', '/callback')}
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border border-neutral-100 rounded-lg">
              <Input
                label="IdP SSO Entry Point"
                value={form.samlEntryPoint}
                onChange={(e) => set('samlEntryPoint', e.target.value)}
                placeholder="https://your-idp.example.com/sso/saml"
              />
              <Input
                label="Issuer (Entity ID)"
                value={form.samlIssuer}
                onChange={(e) => set('samlIssuer', e.target.value)}
                placeholder="your-issuer-id"
              />
              <div>
                <label className="field-label">IdP Certificate (PEM, {form.samlCertSet ? 'leave blank to keep existing' : 'required'})</label>
                <textarea
                  value={form.samlCert}
                  onChange={(e) => set('samlCert', e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                />
              </div>
            </div>
          )}

          {/* Common fields */}
          <div className="space-y-4">
            <Input
              label="Allowed Email Domains (comma-separated, leave blank for any)"
              value={form.allowedEmailDomains}
              onChange={(e) => set('allowedEmailDomains', e.target.value)}
              placeholder="acme.com, acme.io"
              helperText="Only users with these email domains will be allowed to log in via SSO"
            />
            <div>
              <label className="field-label">Default Role for New SSO Users</label>
              <select
                value={form.defaultRole}
                onChange={(e) => set('defaultRole', e.target.value as any)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="hr">HR</option>
                <option value="employer">Employer</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </div>
          </div>

          {/* SSO Login URL */}
          <div className="p-4 bg-primary-50 border border-primary-100 rounded-lg space-y-2">
            <p className="text-sm font-medium text-primary-900">SSO Login URL for your team</p>
            <code className="block text-xs text-primary-700 font-mono break-all">{ssoUrl}</code>
            <p className="text-xs text-primary-600">Share this URL with your team. They can also click "Sign in with SSO" on the login page and enter your company slug.</p>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save SSO Settings
        </Button>
      </div>
    </div>
  );
}
