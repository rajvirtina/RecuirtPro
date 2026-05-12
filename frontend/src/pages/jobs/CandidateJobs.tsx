import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  TrendingUp, 
  CheckCircle,
  Building2,
  Calendar
} from 'lucide-react';

interface Job {
  _id: string;
  title: string;
  companyId: {
    _id: string;
    name: string;
    logo?: string;
    slug: string;
  };
  location: string;
  workMode: 'remote' | 'onsite' | 'hybrid';
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship';
  experienceMin: number;
  experienceMax: number;
  skills: string[];
  createdAt: string;
  status: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
}

export default function CandidateJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/jobs?page=${page}&limit=20&status=published`);
      setJobs(response.data || []);
      setPagination(response.pagination || { page: 1, totalPages: 1, total: 0 });
      if (response.data && response.data.length > 0) {
        setSelectedJob(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const days = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const getWorkModeBadge = (mode: string) => {
    const badges = {
      remote: { label: 'Remote', color: 'bg-green-100 text-green-700' },
      onsite: { label: 'Onsite', color: 'bg-blue-100 text-blue-700' },
      hybrid: { label: 'Hybrid', color: 'bg-purple-100 text-purple-700' }
    };
    return badges[mode as keyof typeof badges] || badges.remote;
  };

  const getJobTypeBadge = (type: string) => {
    const badges = {
      'full-time': { label: 'Full-time', color: 'bg-indigo-100 text-indigo-700' },
      'part-time': { label: 'Part-time', color: 'bg-orange-100 text-orange-700' },
      'contract': { label: 'Contract', color: 'bg-yellow-100 text-yellow-700' },
      'internship': { label: 'Internship', color: 'bg-pink-100 text-pink-700' }
    };
    return badges[type as keyof typeof badges] || badges['full-time'];
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              {jobs[0]?.companyId ? (
                <div className="flex items-center gap-3">
                  {jobs[0].companyId.logo ? (
                    <img
                      src={jobs[0].companyId.logo}
                      alt={jobs[0].companyId.name}
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Open Positions at {jobs[0].companyId.name}
                    </h1>
                    <p className="text-sm text-gray-600 mt-0.5">{pagination.total} job{pagination.total !== 1 ? 's' : ''} available</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Open Positions</h1>
                  <p className="text-sm text-gray-600 mt-1">{pagination.total} jobs available</p>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View Profile
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Job List - Left Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900">Job Listings</h2>
              </div>
              <div className="divide-y max-h-[calc(100vh-200px)] overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job._id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedJob?._id === job._id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Company Logo */}
                      <div className="flex-shrink-0">
                        {job.companyId.logo ? (
                          <img
                            src={job.companyId.logo}
                            alt={job.companyId.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Job Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                          {job.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{job.companyId.name}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getWorkModeBadge(job.workMode).color}`}>
                            {getWorkModeBadge(job.workMode).label}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getJobTypeBadge(job.jobType).color}`}>
                            {getJobTypeBadge(job.jobType).label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(job.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Job Details - Main Content */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Job Header */}
                <div className="p-6 border-b">
                  <div className="flex items-start gap-4">
                    {selectedJob.companyId.logo ? (
                      <img
                        src={selectedJob.companyId.logo}
                        alt={selectedJob.companyId.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-white" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h1>
                      <Link
                        to={`/company/${selectedJob.companyId.slug}/jobs`}
                        className="text-lg text-indigo-600 hover:text-indigo-700 font-medium mb-3 inline-block"
                      >
                        {selectedJob.companyId.name}
                      </Link>
                      
                      <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {selectedJob.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {selectedJob.experienceMin}-{selectedJob.experienceMax} years
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Posted {getTimeAgo(selectedJob.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getWorkModeBadge(selectedJob.workMode).color}`}>
                          {getWorkModeBadge(selectedJob.workMode).label}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getJobTypeBadge(selectedJob.jobType).color}`}>
                          {getJobTypeBadge(selectedJob.jobType).label}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Actively Hiring
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Verified Employer
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="mt-6">
                    <button
                      onClick={() => navigate(`/jobs/${selectedJob._id}/apply`)}
                      className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Apply Now
                    </button>
                  </div>
                </div>

                {/* Job Description */}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Job Description</h2>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <p className="whitespace-pre-wrap">{selectedJob.description || 'No description available.'}</p>
                  </div>

                  {/* Skills Required */}
                  {selectedJob.skills && selectedJob.skills.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-3">Skills Required</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Briefcase className="w-5 h-5" />
                        <span className="text-sm font-medium">Experience</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedJob.experienceMin}-{selectedJob.experienceMax} years
                      </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Calendar className="w-5 h-5" />
                        <span className="text-sm font-medium">Job Type</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {selectedJob.jobType.replace('-', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Job Selected</h3>
                <p className="text-gray-600">Select a job from the list to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => fetchJobs(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchJobs(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
