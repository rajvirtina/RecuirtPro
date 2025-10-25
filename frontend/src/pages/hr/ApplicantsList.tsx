import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { format } from 'date-fns';
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';

interface Application {
  _id: string;
  jobId: {
    _id: string;
    title: string;
    location: string;
  };
  candidateId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  status: string;
  resumeUrl?: string;
  coverLetter?: string;
  expectedSalary?: number;
  createdAt: string;
  updatedAt: string;
}

export default function ApplicantsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    jobId: '',
    search: '',
  });

  useEffect(() => {
    fetchApplications();
  }, [page, filters]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params: any = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.jobId) params.jobId = filters.jobId;

      const response = await apiClient.get('/applications', { params });
      setApplications(response.data.data);
      setTotalPages(Math.ceil(response.data.pagination.total / 20));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const downloadResume = async (applicationId: string, candidateName: string) => {
    try {
      setError('');
      const response = await apiClient.get(`/applications/${applicationId}/resume`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${candidateName.replace(/\s+/g, '_')}_Resume.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(`Resume downloaded for ${candidateName}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to download resume');
    }
  };

  const updateApplicationStatus = async (applicationId: string, status: string) => {
    try {
      setError('');
      await apiClient.put(`/applications/${applicationId}/status`, { status });
      setSuccess('Application status updated successfully');
      fetchApplications();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      applied: { bg: 'bg-blue-100', text: 'text-blue-800' },
      shortlisted: { bg: 'bg-purple-100', text: 'text-purple-800' },
      interview_scheduled: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      in_progress: { bg: 'bg-orange-100', text: 'text-orange-800' },
      selected: { bg: 'bg-green-100', text: 'text-green-800' },
      hired: { bg: 'bg-green-100', text: 'text-green-800' },
      offer_released: { bg: 'bg-teal-100', text: 'text-teal-800' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800' },
      on_hold: { bg: 'bg-gray-100', text: 'text-gray-800' },
      withdrawn: { bg: 'bg-gray-100', text: 'text-gray-800' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const filteredApplications = applications.filter((app) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const candidateName = `${app.candidateId.firstName} ${app.candidateId.lastName}`.toLowerCase();
      const jobTitle = app.jobId.title.toLowerCase();
      const email = app.candidateId.email.toLowerCase();
      
      return (
        candidateName.includes(searchLower) ||
        jobTitle.includes(searchLower) ||
        email.includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Applicants</h1>
        <p className="text-gray-600">View and manage all job applications</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search candidates, jobs, or emails..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <FunnelIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="applied">Applied</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="selected">Selected</option>
              <option value="hired">Hired</option>
              <option value="offer_released">Offer Released</option>
              <option value="rejected">Rejected</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchApplications}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Applications Table */}
      {loading && applications.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <UserCircleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No applications found</h3>
          <p className="text-gray-500">
            {filters.search || filters.status
              ? 'Try adjusting your filters'
              : 'Applications will appear here once candidates apply'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplications.map((application) => (
                  <tr key={application._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {application.candidateId.firstName} {application.candidateId.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{application.candidateId.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{application.jobId.title}</div>
                      <div className="text-sm text-gray-500">{application.jobId.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(application.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(application.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {application.expectedSalary
                        ? `$${application.expectedSalary.toLocaleString()}`
                        : 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {application.resumeUrl ? (
                          <button
                            onClick={() =>
                              downloadResume(
                                application._id,
                                `${application.candidateId.firstName}_${application.candidateId.lastName}`
                              )
                            }
                            className="flex items-center px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                            Resume
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No resume</span>
                        )}
                        
                        <select
                          value={application.status}
                          onChange={(e) => updateApplicationStatus(application._id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="applied">Applied</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="interview_scheduled">Interview Scheduled</option>
                          <option value="selected">Selected</option>
                          <option value="rejected">Rejected</option>
                          <option value="on_hold">On Hold</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
