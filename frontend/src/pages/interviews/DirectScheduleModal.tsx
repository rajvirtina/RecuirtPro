/**
 * DirectScheduleModal — HR schedules an interview for a candidate by email,
 * without requiring the candidate to have applied first.
 * Calls POST /api/v1/interviews/direct-schedule
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import apiClient from '../../services/api';

interface Job { _id: string; title: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  jobs: Job[];
}

const ROUNDS = ['L1', 'L2', 'L3', 'HR', 'technical', 'managerial'] as const;

export default function DirectScheduleModal({ open, onClose, onScheduled, jobs }: Props) {
  const [form, setForm] = useState({
    candidateEmail:     '',
    candidateFirstName: '',
    candidateLastName:  '',
    jobId:              '',
    scheduledTime:      '',
    duration:           60,
    round:              'L1',
    mode:               'online',
    notes:              '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ proctoringUrl: string; candidateCreated: boolean } | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post('/interviews/direct-schedule', {
        ...form,
        duration: Number(form.duration),
      });
      if (res.success) {
        setResult({ proctoringUrl: res.data.proctoringUrl, candidateCreated: res.data.candidateCreated });
        toast.success('Interview scheduled — candidate notified by email');
        onScheduled();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setResult(null); setForm({ candidateEmail: '', candidateFirstName: '', candidateLastName: '', jobId: '', scheduledTime: '', duration: 60, round: 'L1', mode: 'online', notes: '' }); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-neutral-900">Schedule Interview by Email</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Candidate doesn't need to apply first</p>
              </div>
              <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
            </div>

            {result ? (
              <div className="px-6 py-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-emerald-700 font-semibold text-sm">✅ Interview scheduled!</p>
                  {result.candidateCreated && (
                    <p className="text-xs text-emerald-600 mt-1">A new candidate account was created — they can set their password on first login.</p>
                  )}
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Candidate link (via email)</p>
                  <p className="text-xs text-neutral-700 break-all">{result.proctoringUrl}</p>
                </div>
                <button onClick={handleClose} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Done</button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                {/* Candidate info */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Candidate</p>
                  <input
                    name="candidateEmail" type="email" required
                    placeholder="candidate@email.com"
                    value={form.candidateEmail} onChange={handle}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="candidateFirstName" placeholder="First name (optional)"
                      value={form.candidateFirstName} onChange={handle}
                      className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      name="candidateLastName" placeholder="Last name (optional)"
                      value={form.candidateLastName} onChange={handle}
                      className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Job */}
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Job Position</p>
                  <select
                    name="jobId" required value={form.jobId} onChange={handle}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select a job…</option>
                    {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
                  </select>
                </div>

                {/* Date/time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Date & Time</p>
                    <input
                      name="scheduledTime" type="datetime-local" required
                      value={form.scheduledTime} onChange={handle}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Duration (min)</p>
                    <input
                      name="duration" type="number" min={15} max={480}
                      value={form.duration} onChange={handle}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Round & mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Round</p>
                    <select name="round" value={form.round} onChange={handle}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Mode</p>
                    <select name="mode" value={form.mode} onChange={handle}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="online">Online</option>
                      <option value="onsite">On-site</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Notes (optional)</p>
                  <textarea
                    name="notes" rows={2} value={form.notes} onChange={handle}
                    placeholder="Any instructions for the candidate…"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={handleClose}
                    className="flex-1 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-semibold hover:bg-neutral-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors">
                    {loading ? 'Scheduling…' : 'Schedule & Notify'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
