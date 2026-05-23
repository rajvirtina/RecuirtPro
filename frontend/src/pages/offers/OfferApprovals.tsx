import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';

interface PendingOffer {
  _id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  designation: string;
  department: string;
  salary: { amount: number; currency: string; frequency: string };
  joiningDate: string;
  location: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

export default function OfferApprovals() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['offers', 'pending-approval'],
    queryFn: async () => {
      const res = await apiClient.get('/offers?status=pending_approval');
      return (res.data as any)?.offers || res.data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/offers/${id}/status`, {
      status: 'approved',
      remarks: remarks || 'Approved by employer',
    }),
    onSuccess: () => {
      toast.success('Offer approved');
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      setSelectedId(null);
      setRemarks('');
    },
    onError: () => toast.error('Failed to approve offer'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/offers/${id}/status`, {
      status: 'rejected',
      remarks: remarks || 'Rejected by employer',
    }),
    onSuccess: () => {
      toast.success('Offer rejected');
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      setSelectedId(null);
      setRemarks('');
    },
    onError: () => toast.error('Failed to reject offer'),
  });

  const offers: PendingOffer[] = data || [];

  if (user?.role !== 'employer' && user?.role !== 'admin') {
    return (
      <div className="p-6 text-center text-neutral-500">
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm mt-1">Only employers and admins can review offer approvals.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Offer Approvals</h1>
        <p className="page-subtitle">Review and approve pending offers from your HR team.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-neutral-900">All caught up!</h2>
          <p className="text-sm text-neutral-500 mt-1">No offers pending your approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <div
              key={offer._id}
              className={clsx(
                'card p-5 transition-all border-2',
                selectedId === offer._id ? 'border-primary-300 shadow-md' : 'border-transparent'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-neutral-900 truncate">
                      {offer.candidateName}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-700">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5">{offer.candidateEmail}</p>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-400 text-xs block">Position</span>
                      <span className="font-medium text-neutral-800">{offer.designation || offer.jobTitle}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs block">Department</span>
                      <span className="font-medium text-neutral-800">{offer.department || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs block">Salary</span>
                      <span className="font-medium text-neutral-800">
                        {offer.salary?.currency} {offer.salary?.amount?.toLocaleString()} / {offer.salary?.frequency}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs block">Joining Date</span>
                      <span className="font-medium text-neutral-800">
                        {offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 mt-2">
                    Created by {offer.createdBy?.firstName} {offer.createdBy?.lastName} • {new Date(offer.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Download PDF button */}
                  <a
                    href={`${(import.meta as any).env?.VITE_API_URL || '/api/v1'}/offers/${offer._id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
                    title="Download offer letter as PDF"
                  >
                    ↓ PDF
                  </a>
                  <button
                    onClick={() => setSelectedId(selectedId === offer._id ? null : offer._id)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                  >
                    {selectedId === offer._id ? 'Collapse' : 'Review'}
                  </button>
                </div>
              </div>

              {/* Expanded review panel */}
              {selectedId === offer._id && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <label className="field-label">Remarks (optional)</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="field-input mt-1 h-20 resize-none"
                    placeholder="Add a note about your decision..."
                  />
                  <div className="flex gap-3 mt-3">
                    <Button
                      onClick={() => approveMutation.mutate(offer._id)}
                      disabled={approveMutation.isPending}
                      className="bg-success-600 hover:bg-success-700 text-white"
                    >
                      {approveMutation.isPending ? 'Approving...' : '✓ Approve Offer'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => rejectMutation.mutate(offer._id)}
                      disabled={rejectMutation.isPending}
                      className="text-error-600 border-error-200 hover:bg-error-50"
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : '✗ Reject'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
