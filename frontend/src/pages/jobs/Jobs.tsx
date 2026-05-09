import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Job } from '../../types';

export default function Jobs() {
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async (page = 1) => {
    try {
      setLoading(true);
      // For candidates, only show published (non-closed) jobs
      const statusFilter = user?.role === 'candidate' ? '&status=published' : '';
      // For HR/employer, only show jobs from their company
      const companyFilter = (user?.role === 'hr' || user?.role === 'employer') ? '&companySpecific=true' : '';
      const response = await apiClient.get(`/jobs?page=${page}&limit=10${statusFilter}${companyFilter}`);
      setJobs((response.data as any) || []);
      setPagination(response.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === 'candidate' ? 'Find Jobs' : 'Manage Jobs'}
          </h1>
          <p className="text-gray-600 mt-1">
            {pagination.total} job{pagination.total !== 1 ? 's' : ''} available
          </p>
        </div>
        {(user?.role === 'employer' || user?.role === 'hr') && (
          <Link
            to="/jobs/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            + Post New Job
          </Link>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {user?.role === 'candidate'
              ? 'Check back later for new opportunities'
              : 'Get started by creating your first job posting'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Link
              key={job._id}
              to={`/jobs/${job._id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 hover:text-indigo-600">
                    {job.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {job.location}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {job.jobType?.replace('_', ' ')}
                    </span>
                    <span className="flex items-center capitalize">
                      {job.workMode}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-gray-700 line-clamp-2">{job.description}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.skills?.slice(0, 5).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.skills?.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        +{job.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-6 flex flex-col items-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    job.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : job.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status}
                  </span>
                  {job.salaryMin && job.salaryMax && (
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      ₹{(job.salaryMin / 100000).toFixed(1)}L - ₹{(job.salaryMax / 100000).toFixed(1)}L
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {job.experienceMin}-{job.experienceMax} years
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {job.applicationCount} application{job.applicationCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => fetchJobs(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchJobs(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
