import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { format } from 'date-fns';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';

interface Invitation {
  _id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  invitedBy: {
    firstName: string;
    lastName: string;
  };
}

export default function InvitationManagement() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'expired'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchInvitations();
  }, [filter, page]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      setError('');
      const params: any = { page, limit: 10 };
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await apiClient.get('/invitations', { params });
      setInvitations(response.data.data);
      setTotalPages(Math.ceil(response.data.pagination.total / 10));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch invitations');
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      await apiClient.post('/invitations/send', { email });
      
      setSuccess(`Invitation sent successfully to ${email}`);
      setEmail('');
      setShowForm(false);
      fetchInvitations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const resendInvitation = async (invitationId: string, invitationEmail: string) => {
    try {
      setError('');
      setSuccess('');
      
      await apiClient.post(`/invitations/${invitationId}/resend`);
      
      setSuccess(`Invitation resent to ${invitationEmail}`);
      fetchInvitations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend invitation');
    }
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(link);
    setSuccess('Invitation link copied to clipboard!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'accepted':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'expired':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full';
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'accepted':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'expired':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return baseClasses;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Candidate Invitations</h1>
        <p className="text-gray-600">Send invitations to candidates to join your company</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Send Invitation Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center"
        >
          <EnvelopeIcon className="h-5 w-5 mr-2" />
          Send New Invitation
        </button>
      </div>

      {/* Invitation Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Send Candidate Invitation</h2>
          <form onSubmit={sendInvitation}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Candidate Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="candidate@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                The candidate will receive an email with a registration link valid for 7 days
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {['all', 'pending', 'accepted', 'expired'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status as any);
              setPage(1);
            }}
            className={`px-4 py-2 font-medium capitalize transition ${
              filter === status
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Invitations Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <EnvelopeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No invitations found</h3>
          <p className="text-gray-500">Send your first invitation to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <tr key={invitation._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{invitation.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invitation.status)}
                      <span className={getStatusBadge(invitation.status)}>
                        {invitation.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(invitation.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(invitation.expiresAt), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {invitation.status === 'pending' && (
                        <>
                          <button
                            onClick={() => copyInvitationLink(invitation.token)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            Copy Link
                          </button>
                          <button
                            onClick={() => resendInvitation(invitation._id, invitation.email)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Resend
                          </button>
                        </>
                      )}
                      {invitation.status === 'expired' && (
                        <button
                          onClick={() => resendInvitation(invitation._id, invitation.email)}
                          className="text-yellow-600 hover:text-yellow-900 font-medium"
                        >
                          Resend
                        </button>
                      )}
                      {invitation.status === 'accepted' && invitation.acceptedAt && (
                        <span className="text-gray-500 text-xs">
                          Accepted {format(new Date(invitation.acceptedAt), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
