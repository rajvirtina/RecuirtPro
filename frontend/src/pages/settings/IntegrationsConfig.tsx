import { clsx } from 'clsx';

interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
  authType: 'oauth' | 'apikey';
}

const INTEGRATIONS: Integration[] = [
  { id: 'teams', name: 'Microsoft Teams', icon: '💬', connected: false, authType: 'oauth' },
  { id: 'google-calendar', name: 'Google Calendar', icon: '📅', connected: false, authType: 'oauth' },
  { id: 'zoho', name: 'Zoho', icon: '🔗', connected: false, authType: 'oauth' },
  { id: 'naukri', name: 'Naukri', icon: '💼', connected: false, authType: 'apikey' },
  { id: 'github-jobs', name: 'GitHub Jobs', icon: '🐙', connected: false, authType: 'apikey' },
];

export default function IntegrationsConfig() {
  return (
    <div className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Integrations</h2>
      <p className="text-sm text-neutral-500">Connect third-party services to streamline your hiring workflow.</p>

      <div className="space-y-3">
        {INTEGRATIONS.map((intg) => (
          <div key={intg.id} className="flex items-center justify-between py-3 px-4 rounded-lg border border-neutral-200 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{intg.icon}</span>
              <div>
                <p className="text-sm font-medium text-neutral-900">{intg.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                    intg.connected ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500'
                  )}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', intg.connected ? 'bg-success-500' : 'bg-neutral-400')} />
                    {intg.connected ? 'Connected' : 'Not Connected'}
                  </span>
                  {intg.lastSync && (
                    <span className="text-xs text-neutral-400">Last sync: {intg.lastSync}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              className={clsx(
                'text-sm font-medium px-4 py-1.5 rounded-lg transition-colors',
                intg.connected
                  ? 'text-error-600 hover:bg-error-50 border border-error-200'
                  : 'text-primary-600 hover:bg-primary-50 border border-primary-200'
              )}
            >
              {intg.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
