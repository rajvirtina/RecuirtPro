import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

// ─── Types ───────────────────────────────────────────────────
interface Offer {
  _id: string;
  applicationId: string;
  jobId: any;
  candidateId: any;
  createdBy: any;
  approvedBy?: any;
  status: string;
  designation: string;
  department?: string;
  salary: { amount: number; currency: string; frequency: string };
  bonus?: { amount: number; type: string };
  equity?: { percentage: number; vestingPeriod: string };
  joiningDate: string;
  location?: string;
  workMode?: string;
  probationPeriod?: number;
  noticePeriod?: number;
  benefits?: string[];
  additionalTerms?: string;
  sentAt?: string;
  expiresAt?: string;
  respondedAt?: string;
  approvedAt?: string;
  statusHistory: { status: string; changedBy: string; changedAt: string; remarks?: string }[];
  negotiations?: { round: number; proposedBy: string; changes: any; comments?: string; createdAt: string }[];
  offerLetterHtml?: string;
  candidateComments?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  negotiating: 'bg-orange-100 text-orange-800',
  withdrawn: 'bg-gray-200 text-gray-600',
  expired: 'bg-red-50 text-red-600',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'sent', 'withdrawn'],
  pending_approval: ['approved', 'draft', 'withdrawn'],
  approved: ['sent', 'withdrawn'],
  sent: ['accepted', 'rejected', 'negotiating', 'withdrawn'],
  negotiating: ['sent', 'accepted', 'rejected', 'withdrawn'],
  expired: ['sent'],
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
    {status.replace(/_/g, ' ')}
  </span>
);

// ─── Main Component ──────────────────────────────────────────
export default function OfferManagement() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // List state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Create state
  const [applications, setApplications] = useState<any[]>([]);
  const [form, setForm] = useState({
    applicationId: '',
    designation: '',
    department: '',
    salaryAmount: '',
    salaryCurrency: 'INR',
    salaryFrequency: 'yearly',
    bonusAmount: '',
    bonusType: 'annual',
    joiningDate: '',
    location: '',
    workMode: 'onsite',
    probationPeriod: '6',
    noticePeriod: '30',
    benefits: '',
    additionalTerms: '',
  });

  // Letter preview
  const [letterHtml, setLetterHtml] = useState('');
  const [showLetter, setShowLetter] = useState(false);

  // Status update
  const [statusRemarks, setStatusRemarks] = useState('');

  // ── Fetchers ───────────────────────────────────────────────
  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/offers?status=${statusFilter}` : '/offers';
      const res = await apiClient.get(url);
      setOffers(res.data?.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [statusFilter]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await apiClient.get('/applications?status=selected&limit=100');
      setApplications(res.data?.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);
  useEffect(() => { if (activeTab === 'create') fetchApplications(); }, [activeTab, fetchApplications]);

  // ── Actions ────────────────────────────────────────────────
  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/offers', {
        applicationId: form.applicationId,
        designation: form.designation,
        department: form.department,
        salary: { amount: Number(form.salaryAmount), currency: form.salaryCurrency, frequency: form.salaryFrequency },
        bonus: form.bonusAmount ? { amount: Number(form.bonusAmount), type: form.bonusType } : undefined,
        joiningDate: form.joiningDate,
        location: form.location,
        workMode: form.workMode,
        probationPeriod: Number(form.probationPeriod),
        noticePeriod: Number(form.noticePeriod),
        benefits: form.benefits ? form.benefits.split(',').map((b) => b.trim()) : [],
        additionalTerms: form.additionalTerms,
      });
      setMessage({ type: 'success', text: 'Offer created successfully' });
      setActiveTab('list');
      setForm({ applicationId: '', designation: '', department: '', salaryAmount: '', salaryCurrency: 'INR', salaryFrequency: 'yearly', bonusAmount: '', bonusType: 'annual', joiningDate: '', location: '', workMode: 'onsite', probationPeriod: '6', noticePeriod: '30', benefits: '', additionalTerms: '' });
      fetchOffers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create offer' });
    }
  };

  const updateStatus = async (offerId: string, newStatus: string) => {
    try {
      const res = await apiClient.put(`/offers/${offerId}/status`, { status: newStatus, remarks: statusRemarks });
      setMessage({ type: 'success', text: `Offer status updated to ${newStatus.replace(/_/g, ' ')}` });
      setStatusRemarks('');
      if (selectedOffer?._id === offerId) setSelectedOffer(res.data?.data || null);
      fetchOffers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update status' });
    }
  };

  const generateLetter = async (offerId: string) => {
    try {
      const res = await apiClient.post(`/offers/${offerId}/generate-letter`);
      setLetterHtml(res.data?.data?.offerLetterHtml || '');
      setShowLetter(true);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to generate letter' });
    }
  };

  const viewOfferDetail = async (offerId: string) => {
    try {
      const res = await apiClient.get(`/offers/${offerId}`);
      setSelectedOffer(res.data?.data || null);
    } catch { /* ignore */ }
  };

  // ── Access guard ───────────────────────────────────────────
  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Only HR, Admin, or Employer roles can manage offers.</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Offer Management</h1>
          <p className="mt-1 text-gray-600">Create, track, and manage candidate offers</p>
        </div>
        <button onClick={() => setActiveTab(activeTab === 'create' ? 'list' : 'create')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}>
          {activeTab === 'create' ? 'Back to List' : '+ New Offer'}
        </button>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <div className="flex justify-between">
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* ─── DETAIL VIEW ──────────────────────────────────────── */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOffer(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedOffer.designation}</h2>
                <p className="text-sm text-gray-500">{selectedOffer.department}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedOffer.status} />
                <button onClick={() => setSelectedOffer(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Candidate & Job */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Candidate</div>
                  <div className="font-medium text-gray-900">
                    {selectedOffer.candidateId?.firstName} {selectedOffer.candidateId?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{selectedOffer.candidateId?.email}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Job</div>
                  <div className="font-medium text-gray-900">{selectedOffer.jobId?.title}</div>
                </div>
              </div>

              {/* Compensation */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">Compensation</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Salary</div>
                    <div className="font-medium">{selectedOffer.salary.currency} {selectedOffer.salary.amount.toLocaleString()} / {selectedOffer.salary.frequency}</div>
                  </div>
                  {selectedOffer.bonus && (
                    <div>
                      <div className="text-xs text-gray-500">Bonus</div>
                      <div className="font-medium">{selectedOffer.salary.currency} {selectedOffer.bonus.amount.toLocaleString()} ({selectedOffer.bonus.type})</div>
                    </div>
                  )}
                  {selectedOffer.equity && (
                    <div>
                      <div className="text-xs text-gray-500">Equity</div>
                      <div className="font-medium">{selectedOffer.equity.percentage}% ({selectedOffer.equity.vestingPeriod})</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-500">Joining Date</div>
                    <div className="font-medium">{new Date(selectedOffer.joiningDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Location / Mode</div>
                    <div className="font-medium">{selectedOffer.location || 'N/A'} · {selectedOffer.workMode || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Probation</div>
                    <div className="font-medium">{selectedOffer.probationPeriod || 'N/A'} months</div>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              {selectedOffer.benefits && selectedOffer.benefits.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">Benefits</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOffer.benefits.map((b) => (
                      <span key={b} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">{b}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Status History */}
              {selectedOffer.statusHistory?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">Status History</h3>
                  <div className="space-y-2">
                    {selectedOffer.statusHistory.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <StatusBadge status={h.status} />
                        <span className="text-gray-500">{new Date(h.changedAt).toLocaleString()}</span>
                        {h.remarks && <span className="text-gray-600 italic">— {h.remarks}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(STATUS_TRANSITIONS[selectedOffer.status] || []).map((next) => (
                    <button key={next} onClick={() => updateStatus(selectedOffer._id, next)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        next === 'withdrawn' ? 'border border-red-300 text-red-600 hover:bg-red-50'
                          : next === 'approved' ? 'bg-green-600 text-white hover:bg-green-700'
                          : next === 'sent' ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                      {next.replace(/_/g, ' ')}
                    </button>
                  ))}
                  <button onClick={() => generateLetter(selectedOffer._id)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                    Generate Letter
                  </button>
                </div>
                <div className="mt-3">
                  <input type="text" value={statusRemarks} onChange={(e) => setStatusRemarks(e.target.value)}
                    placeholder="Remarks (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LETTER PREVIEW MODAL ─────────────────────────────── */}
      {showLetter && letterHtml && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLetter(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Offer Letter Preview</h2>
              <button onClick={() => setShowLetter(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6" dangerouslySetInnerHTML={{ __html: letterHtml }} />
          </div>
        </div>
      )}

      {/* ─── CREATE OFFER FORM ────────────────────────────────── */}
      {activeTab === 'create' && (
        <form onSubmit={createOffer} className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Create New Offer</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Application */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Application *</label>
              <select required value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Select application...</option>
                {applications.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.candidateId?.firstName || 'Candidate'} {a.candidateId?.lastName || ''} — {a.job?.title || a.jobId}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Only applications with &quot;selected&quot; status are shown</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
              <input required type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Senior Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Engineering" />
            </div>

            {/* Salary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary Amount *</label>
              <div className="flex gap-2">
                <select value={form.salaryCurrency} onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <input required type="number" min="0" value={form.salaryAmount}
                  onChange={(e) => setForm({ ...form, salaryAmount: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., 1200000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary Frequency</label>
              <select value={form.salaryFrequency} onChange={(e) => setForm({ ...form, salaryFrequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Bonus */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Amount</label>
              <input type="number" min="0" value={form.bonusAmount}
                onChange={(e) => setForm({ ...form, bonusAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Type</label>
              <select value={form.bonusType} onChange={(e) => setForm({ ...form, bonusType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="annual">Annual</option>
                <option value="signing">Signing</option>
                <option value="performance">Performance</option>
              </select>
            </div>

            {/* Joining */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date *</label>
              <input required type="date" value={form.joiningDate}
                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Bangalore" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Mode</label>
              <select value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Probation (months)</label>
              <input type="number" min="0" value={form.probationPeriod}
                onChange={(e) => setForm({ ...form, probationPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
              <input type="number" min="0" value={form.noticePeriod}
                onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            {/* Benefits */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Benefits (comma-separated)</label>
              <input type="text" value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Health Insurance, Stock Options, Gym Membership" />
            </div>

            {/* Additional Terms */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Terms</label>
              <textarea rows={3} value={form.additionalTerms} onChange={(e) => setForm({ ...form, additionalTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Any additional terms or conditions..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setActiveTab('list')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              Create Offer
            </button>
          </div>
        </form>
      )}

      {/* ─── OFFERS LIST ──────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div>
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">All Statuses</option>
              {['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'negotiating', 'withdrawn', 'expired'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{offers.length} offer{offers.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 mx-auto" />
            </div>
          ) : offers.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {offers.map((offer) => (
                    <tr key={offer._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => viewOfferDetail(offer._id)}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {offer.candidateId?.firstName} {offer.candidateId?.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{offer.candidateId?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{offer.designation}</div>
                        <div className="text-xs text-gray-500">{offer.jobId?.title}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {offer.salary.currency} {offer.salary.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={offer.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {(STATUS_TRANSITIONS[offer.status] || []).slice(0, 2).map((next) => (
                            <button key={next} onClick={() => updateStatus(offer._id, next)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700">
                              {next.replace(/_/g, ' ')}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Offers Yet</h3>
              <p className="text-gray-500 text-sm mb-4">Create your first offer for a selected candidate</p>
              <button onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                + New Offer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
