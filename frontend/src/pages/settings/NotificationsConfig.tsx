import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';

/* ── Toggle switch row ──────────────────────────────────────────────────── */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className={clsx('flex items-center justify-between py-3', disabled && 'opacity-50 cursor-not-allowed')}>
      <div className="flex-1 pr-4">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
        {hint && <p className="text-xs text-neutral-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={clsx(
          'relative w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 shrink-0',
          checked ? 'bg-primary-600' : 'bg-neutral-300',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function NotificationsConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => apiClient.get('/companies/settings').then(r => r.data.data),
  });

  const [notifs, setNotifs] = useState<Record<string, boolean> | null>(null);

  if (data && !notifs) {
    setNotifs({
      emailOnNewApplication: data.notifications?.emailOnNewApplication ?? true,
      emailOnStageChange:    data.notifications?.emailOnStageChange    ?? true,
      smsEnabled:            data.notifications?.smsEnabled            ?? false,
      dailyDigest:           data.notifications?.dailyDigest           ?? false,
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

  const toggle = (key: string) =>
    setNotifs(prev => (prev ? { ...prev, [key]: !prev[key] } : prev));

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Notification Preferences</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Choose when RecuirtPro sends email or SMS alerts to your team.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">
        <ToggleRow
          label="New application received"
          description="Email your hiring team every time a candidate applies."
          checked={!!notifs?.emailOnNewApplication}
          onChange={() => toggle('emailOnNewApplication')}
        />
        <ToggleRow
          label="Candidate stage changed"
          description="Get notified when an application moves to a new pipeline stage."
          checked={!!notifs?.emailOnStageChange}
          onChange={() => toggle('emailOnStageChange')}
        />
        <ToggleRow
          label="SMS notifications"
          description="Receive critical alerts via SMS for urgent hiring updates."
          checked={!!notifs?.smsEnabled}
          onChange={() => toggle('smsEnabled')}
          disabled
          hint="Requires SMS_API_KEY to be configured in your environment."
        />
        <ToggleRow
          label="Daily hiring digest"
          description="A morning summary email at 9 am with activity from the last 24 hours."
          checked={!!notifs?.dailyDigest}
          onChange={() => toggle('dailyDigest')}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => notifs && mutation.mutate(notifs)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving…' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
