/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface HRUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  phone?: string;
  createdAt: string;
}

interface AdminStats {
  totalHR: number;
  activeHR: number;
  pendingHR: number;
  suspendedHR: number;
  totalCandidates: number;
}

export default function AdminHRManagement() {
  const [hrUsers, setHrUsers] = useState<HRUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailDomainError, setEmailDomainError] = useState('');
  const currentUser = useAuthStore((state) => state.user);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'hr',
    department: '',
    phone: '',
  });
  const [filter, setFilter] = useState({ status: '', role: '', search: '' });

  useEffect(() => {
    fetchHRUsers();
    fetchStats();
  }, [filter]);

  const fetchHRUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/hr-users', { params: filter });
      console.log('HR Users Response:', response);
      
      // apiClient already unwraps to { success, message, data }
      // So response.data contains { users, pagination }
      if (response.data && response.data.users) {
        setHrUsers(response.data.users || []);
      } else {
        console.error('Unexpected response structure:', response);
        setHrUsers([]);
      }
    } catch (error: any) {
      console.error('Error fetching HR users:', error);
      console.error('Error response:', error.response?.data);
      setHrUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/admin/stats');
      console.log('Stats Response:', response);
      
      // apiClient already unwraps to { success, message, data }
      // So response.data contains the stats object
      if (response.data) {
        setStats(response.data);
      } else {
        console.error('Unexpected stats response structure:', response);
      }
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const handleInviteHR = async (e: React.FormEvent) => {
    e.preventDefault();

    // Email domain validation
    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
      'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'live.com',
      'msn.com', 'rediffmail.com', 'google.com'];
    const invitedDomain = formData.email.toLowerCase().split('@')[1];
    const adminDomain = currentUser?.email?.toLowerCase().split('@')[1];

    if (adminDomain) {
      if (invitedDomain !== adminDomain) {
        setEmailDomainError(
          `Email domain "@${invitedDomain}" does not match your company domain "@${adminDomain}". HR users must use a company email.`
        );
        return;
      }
    }
    setEmailDomainError('');

    try {
      await apiClient.post('/admin/invite-hr', formData);
      alert('HR invitation sent successfully!');
      setShowInviteModal(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'hr',
        department: '',
        phone: '',
      });
      fetchHRUsers();
      fetchStats();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send invitation');
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      await apiClient.patch(`/admin/hr-users/${userId}/status`, { status: newStatus });
      alert('Status updated successfully');
      fetchHRUsers();
      fetchStats();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      await apiClient.post(`/admin/hr-users/${userId}/resend-invitation`);
      alert('Invitation resent successfully! Check the backend console for the invitation URL (dev mode).');
      console.log('✅ Invitation Resent - Check backend console for invitation URL');
      fetchHRUsers(); // Refresh the list
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to resend invitation');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await apiClient.delete(`/admin/hr-users/${userId}`);
      alert('User deleted successfully');
      fetchHRUsers();
      fetchStats();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending_verification':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">HR Management</h1>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          + Invite HR User
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Total HR/Staff</p>
            <p className="text-2xl font-bold">{stats.totalHR}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeHR}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingHR}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Suspended</p>
            <p className="text-2xl font-bold text-red-600">{stats.suspendedHR}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Total Candidates</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalCandidates}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="border rounded-lg px-4 py-2"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="border rounded-lg px-4 py-2"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_verification">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={filter.role}
            onChange={(e) => setFilter({ ...filter, role: e.target.value })}
            className="border rounded-lg px-4 py-2"
          >
            <option value="">All Roles</option>
            <option value="hr">HR</option>
            <option value="interviewer">Interviewer</option>
            <option value="employer">Employer</option>
          </select>
        </div>
      </div>

      {/* HR Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : hrUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No HR users found
                </td>
              </tr>
            ) : (
              hrUsers.map((user) => (
                <tr key={user._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize text-sm text-gray-900">{user.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                        user.status
                      )}`}
                    >
                      {user.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {user.status === 'pending_verification' && (
                      <button
                        onClick={() => handleResendInvitation(user._id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Resend
                      </button>
                    )}
                    {user.status === 'active' ? (
                      <button
                        onClick={() => handleUpdateStatus(user._id, 'suspended')}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Suspend
                      </button>
                    ) : user.status === 'suspended' ? (
                      <button
                        onClick={() => handleUpdateStatus(user._id, 'active')}
                        className="text-green-600 hover:text-green-900"
                      >
                        Activate
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Invite HR User</h2>
            <form onSubmit={handleInviteHR}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setEmailDomainError(''); }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {emailDomainError && (
                    <p className="mt-1 text-sm text-red-600">{emailDomainError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="hr">HR</option>
                    <option value="interviewer">Interviewer</option>
                    <option value="employer">Employer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
