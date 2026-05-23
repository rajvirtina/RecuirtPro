import { useState } from 'react';
import { clsx } from 'clsx';
import CompanyProfile from './CompanyProfile';
import PipelineStagesConfig from './PipelineStagesConfig';
import NotificationsConfig from './NotificationsConfig';
import IntegrationsConfig from './IntegrationsConfig';
import PermissionMatrix from './PermissionMatrix';

type Section = 'profile' | 'pipeline' | 'notifications' | 'integrations' | 'permissions';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile',       label: 'Company Profile',   icon: '🏢' },
  { id: 'pipeline',      label: 'Pipeline Stages',   icon: '📊' },
  { id: 'notifications', label: 'Notifications',     icon: '🔔' },
  { id: 'integrations',  label: 'Integrations',      icon: '🔌' },
  { id: 'permissions',   label: 'Permissions',       icon: '🔐' },
];

export default function Settings() {
  const [section, setSection] = useState<Section>('profile');

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage your company settings, branding, and integrations.</p>

      <div className="mt-6 flex gap-6">
        {/* Left nav */}
        <nav className="w-56 shrink-0 space-y-1" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={clsx(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                section === s.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50',
              )}
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {section === 'profile'       && <CompanyProfile />}
          {section === 'pipeline'      && <PipelineStagesConfig />}
          {section === 'notifications' && <NotificationsConfig />}
          {section === 'integrations'  && <IntegrationsConfig />}
          {section === 'permissions'   && <PermissionMatrix />}
        </div>
      </div>
    </div>
  );
}
