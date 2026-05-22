import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import apiClient from '../../services/api';
import { toast } from 'sonner';

interface IntegrationStatus {
  platform: string;
  status: 'connected' | 'disconnected';
  connectedBy?: string;
  externalUsername?: string;
  isExpired?: boolean;
}

const INTEGRATION_META: Record<string, { name: string; icon: string; authType: 'oauth' | 'apikey' }> = {
  linkedin:       { name: 'LinkedIn',          icon: '💼', authType: 'oauth'   },
  naukri:         { name: 'Naukri',            icon: '🔖', authType: 'apikey'  },
  github:         { name: 'GitHub Jobs',       icon: '🐙', authType: 'oauth'   },
  teams:          { name: 'Microsoft Teams',   icon: '💬', authType: 'oauth'   },
  'google-calendar': { name: 'Google Calendar', icon: '📅', authType: 'oauth' },
  zoho:           { name: 'Zoho',              icon: '🔗', authType: 'oauth'   },
};

export default function IntegrationsConfig() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const fetchIntegrations = async () => {
    try {
      const res = await apiClient.get('/sourcing/integrations');
      const d = (res.data as any)?.data?.integrations ?? (res.data as any)?.integrations ?? [];
      setIntegrations(Array.isArray(d) ? d : []);
    } catch {
      // silently fail — show all as disconnected
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    // Re-check integrations if returning from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      toast.success(`${params.get('connected')} connected successfully!`);
      fetchIntegrations();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      toast.error(`Integration failed: ${params.get('error')?.replace(/_/g, ' ')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async (platform: string) => {
    const meta = INTEGRATION_META[platform];
    if (!meta) return;

    setConnecting(platform);
    try {
      if (meta.authType === 'oauth') {
        // Initiate OAuth — backend returns { data: { authUrl } }
        const res = await apiClient.post(`/sourcing/oauth/${platform}/connect`);
        const authUrl = (res.data as any)?.data?.authUrl ?? (res.data as any)?.authUrl;
        if (authUrl) {
          window.location.href = authUrl;
        } else {
          toast.error('Could not get OAuth URL. Please try again.');
        }
      } else {
        // API key type — handled inline via prompt or modal (simplified)
        const key = apiKeys[platform]?.trim();
        if (!key) {
          toast.error('Please enter your API key first.');
          return;
        }
        await apiClient.post(`/sourcing/oauth/${platform}/connect`, { apiKey: key });
        toast.success(`${meta.name} connected!`);
        fetchIntegrations();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to connect ${meta.name}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!window.confirm(`Disconnect ${INTEGRATION_META[platform]?.name || platform}?`)) return;
    try {
      await apiClient.delete(`/sourcing/integrations/${platform}`);
      toast.success('Integration disconnected.');
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to disconnect');
    }
  };

  // Build merged list: start from our known platforms + any extra from API
  const knownPlatforms = Object.keys(INTEGRATION_META);
  const apiPlatforms   = integrations.map(i => i.platform);
  const allPlatforms   = Array.from(new Set([...knownPlatforms, ...apiPlatforms]));

  const getStatus = (platform: string): IntegrationStatus => {
    return integrations.find(i => i.platform === platform) ?? {
      platform,
      status: 'disconnected',
    };
  };

  if (loading) return <div className="animate-pulse h-64 bg-neutral-100 rounded-xl" />;

  return (
    <div className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Integrations</h2>
      <p className="text-sm text-neutral-500">Connect third-party services to streamline your hiring workflow.</p>

      <div className="space-y-3">
        {allPlatforms.map((platform) => {
          const status = getStatus(platform);
          const meta   = INTEGRATION_META[platform] ?? { name: platform, icon: '🔌', authType: 'oauth' as const };
          const isConnected = status.status === 'connected';
          const isBusy      = connecting === platform;

          return (
            <div key={platform} className="flex items-center justify-between py-3 px-4 rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{meta.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                      isConnected ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500'
                    )}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-success-500' : 'bg-neutral-400')} />
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                    {isConnected && status.externalUsername && (
                      <span className="text-xs text-neutral-400">as {status.externalUsername}</span>
                    )}
                    {isConnected && status.isExpired && (
                      <span className="text-xs text-error-600 font-medium">⚠ Token Expired</span>
                    )}
                  </div>

                  {/* API key input for apikey-type integrations */}
                  {!isConnected && meta.authType === 'apikey' && (
                    <input
                      type="text"
                      placeholder="Paste API key..."
                      value={apiKeys[platform] || ''}
                      onChange={e => setApiKeys(k => ({ ...k, [platform]: e.target.value }))}
                      className="mt-1 text-xs px-2 py-1 border border-neutral-200 rounded w-48 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                  )}
                </div>
              </div>

              <button
                onClick={() => isConnected ? handleDisconnect(platform) : handleConnect(platform)}
                disabled={isBusy}
                className={clsx(
                  'text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50',
                  isConnected
                    ? 'text-error-600 hover:bg-error-50 border border-error-200'
                    : 'text-primary-600 hover:bg-primary-50 border border-primary-200'
                )}
              >
                {isBusy ? 'Connecting…' : isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
