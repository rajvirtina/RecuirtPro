import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';

interface RetentionSettings {
  dataRetentionMonths: number;
  autoDeleteRejected: boolean;
}

export default function DataRetention() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<RetentionSettings>({
    queryKey: ['retention-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/company/settings/retention');
      return res.data?.data ?? { dataRetentionMonths: 12, autoDeleteRejected: false };
    },
  });

  const [form, setForm] = useState<RetentionSettings>({
    dataRetentionMonths: 12,
    autoDeleteRejected: false,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: RetentionSettings) =>
      apiClient.patch('/company/settings/retention', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Data & Privacy</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Configure how long candidate data is retained and when it is automatically purged.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Important:</strong> Deleted records are soft-deleted (marked with a deletion timestamp) and
        cannot be recovered through the UI. Ensure your data retention policy complies with applicable
        privacy regulations (GDPR, DPDP Act, etc.).
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        {/* Retention period */}
        <div className="p-6">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Rejected Candidate Retention Period
          </label>
          <p className="text-xs text-neutral-500 mb-3">
            How long to keep rejected applications before they are eligible for auto-deletion.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={84}
              value={form.dataRetentionMonths}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dataRetentionMonths: Number(e.target.value) }))
              }
              className="w-24 input"
            />
            <span className="text-sm text-neutral-600">months</span>
            <span className="text-xs text-neutral-400">(1 – 84 months)</span>
          </div>
        </div>

        {/* Auto-delete toggle */}
        <div className="p-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-neutral-700">Auto-delete Rejected Applications</p>
            <p className="text-xs text-neutral-500 mt-1">
              When enabled, rejected applications older than the retention period are automatically
              soft-deleted every night at 2 AM. Only records from this company are affected.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.autoDeleteRejected}
            onClick={() =>
              setForm((prev) => ({ ...prev, autoDeleteRejected: !prev.autoDeleteRejected }))
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              form.autoDeleteRejected ? 'bg-primary-600' : 'bg-neutral-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                form.autoDeleteRejected ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="btn-primary"
        >
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Settings saved.</span>
        )}
        {mutation.isError && (
          <span className="text-sm text-red-600">Failed to save. Please try again.</span>
        )}
      </div>
    </div>
  );
}
