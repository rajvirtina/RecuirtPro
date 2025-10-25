import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import ApplicationForm from '../../components/applications/ApplicationForm';

interface Job {
  _id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  location: string;
  jobType: string;
  workMode: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  skills: string[];
  status: string;
  companyId: string;
  createdBy: string;
  positions?: number;
  tags?: string[];
  viewCount?: number;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchJobDetail();
  }, [id]);

  const fetchJobDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/jobs/${id}`);
      console.log('Job API response:', response);
      setJob(response.data.job);
    } catch (error) {
      console.error('Failed to fetch job:', error);
      setMessage({ type: 'error', text: 'Failed to load job details' });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!user) {
      navigate('/login', { state: { from: `/jobs/${id}` } });
      return;
    }

    setShowApplicationForm(true);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;

    try {
      await apiClient.delete(`/jobs/${id}`);
      navigate('/jobs');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete job',
      });
    }
  };

  const handleCloseJob = async () => {
    if (!confirm('Are you sure you want to close this job posting?')) return;

    try {
      await apiClient.put(`/jobs/${id}`, { status: 'closed' });
      setMessage({ type: 'success', text: 'Job closed successfully!' });
      await fetchJobDetail();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to close job',
      });
    }
  };

  const handlePublishJob = async () => {
    try {
      await apiClient.put(`/jobs/${id}`, { status: 'published' });
      setMessage({ type: 'success', text: 'Job published successfully!' });
      await fetchJobDetail();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to publish job',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Job not found</h2>
        <button
          onClick={() => navigate('/jobs')}
          className="mt-4 text-indigo-600 hover:text-indigo-800"
        >
           Back to Jobs
        </button>
      </div>
    );
  }

  const isOwner = (user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin') && user?._id === job.createdBy;
  const canApply = user?.role === 'candidate' && (job.status === 'published' || job.status === 'active');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/jobs')}
        className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </button>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {job.jobType?.replace('_', ' ').toUpperCase()}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {job.workMode?.charAt(0).toUpperCase() + job.workMode?.slice(1)}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {job.experienceMin}-{job.experienceMax} years
                </span>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ml-4 ${
                job.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : job.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-800'
                  : job.status === 'closed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {job.status?.toUpperCase()}
            </span>
          </div>

          {job.salaryMin && job.salaryMax && (
            <div className="mt-4 text-lg font-semibold text-indigo-600">
              {job.currency} {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
            </div>
          )}
        </div>

        <div className="p-6">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
            <div className="prose text-gray-700 whitespace-pre-wrap">{job.description}</div>
          </section>

          {job.requirements && job.requirements.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                {job.requirements.map((req, index) => (
                  <li key={index}>{req}</li>
                ))}
              </ul>
            </section>
          )}

          {job.skills && job.skills.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="text-sm text-gray-500">
            Posted on {new Date(job.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {job.applicationCount !== undefined && (
              <span className="ml-4">
                {job.applicationCount} application{job.applicationCount !== 1 ? 's' : ''}
              </span>
            )}
            {job.positions && job.positions > 1 && (
              <span className="ml-4">
                {job.positions} position{job.positions !== 1 ? 's' : ''} available
              </span>
            )}
          </section>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3 flex-wrap">
          {canApply && job.status !== 'closed' && (
            <button
              onClick={handleApply}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >
              Apply Now
            </button>
          )}

          {user?.role === 'candidate' && job.status === 'closed' && (
            <div className="px-6 py-3 bg-red-50 text-red-800 rounded-lg border border-red-200">
              This position is closed
            </div>
          )}

          {isOwner && (
            <>
              {job.status === 'draft' && (
                <button
                  onClick={handlePublishJob}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  Publish Job
                </button>
              )}
              {job.status === 'closed' && (
                <button
                  onClick={handlePublishJob}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  Reopen Job
                </button>
              )}
              {job.status === 'published' && (
                <button
                  onClick={handleCloseJob}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
                >
                  Close Job
                </button>
              )}
              <button
                onClick={() => navigate(`/jobs/${id}/edit`)}
                className="px-6 py-3 bg-white text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
              >
                Edit Job
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-3 bg-white text-red-600 border border-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
              >
                Delete Job
              </button>
            </>
          )}

          {!user && (
            <button
              onClick={() => navigate('/login', { state: { from: `/jobs/${id}` } })}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >
              Login to Apply
            </button>
          )}
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowApplicationForm(false);
          }}
        >
          <ApplicationForm
            jobId={id!}
            onSuccess={() => {
              setShowApplicationForm(false);
              setMessage({ type: 'success', text: 'Application submitted successfully!' });
            }}
            onCancel={() => setShowApplicationForm(false)}
          />
        </div>
      )}
    </div>
  );
}
