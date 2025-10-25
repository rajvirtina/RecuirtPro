import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface ApplicationDetail {
  _id: string;
  job: {
    _id: string;
    title: string;
    location?: string;
  };
  candidate?: {
    _id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  status: string;
  coverLetter?: string;
  resume?: string;
  skillMatchScore?: number;
  experienceMatchScore?: number;
  overallScore?: number;
  appliedAt: string;
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    fetchApplicationDetail();
  }, [id]);

  const fetchApplicationDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/applications/${id}`);
      console.log('Application API response:', response);
      
      // Map API response to match interface
      const apiData = response.data;
      const mappedData: ApplicationDetail = {
        _id: apiData._id,
        job: {
          _id: apiData.jobId?._id || apiData.jobId,
          title: apiData.jobId?.title || 'N/A',
          location: apiData.jobId?.location,
        },
        candidate: apiData.candidateId ? {
          _id: apiData.candidateId._id,
          firstName: apiData.candidateId.firstName,
          lastName: apiData.candidateId.lastName,
          email: apiData.candidateId.email,
          phone: apiData.candidateId.phone,
        } : undefined,
        status: apiData.status,
        coverLetter: apiData.coverLetter,
        resume: apiData.resumeUrl,
        skillMatchScore: apiData.skillMatchScore,
        experienceMatchScore: apiData.experienceMatchScore,
        overallScore: apiData.overallScore,
        appliedAt: apiData.createdAt || apiData.appliedAt,
      };
      
      setApplication(mappedData);
    } catch (error: any) {
      console.error('Failed to fetch application:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load application details',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await apiClient.put(`/applications/${id}/status`, { status: newStatus });
      setMessage({ type: 'success', text: 'Status updated successfully!' });
      await fetchApplicationDetail();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update status',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      setScheduling(true);
      const scheduledTime = new Date(`${formData.get('date')}T${formData.get('time')}`).toISOString();
      
      await apiClient.post('/interviews', {
        applicationId: application?._id,
        jobId: application?.job._id,
        candidateId: application?.candidate?._id,
        scheduledTime,
        duration: parseInt(formData.get('duration') as string) || 60,
        mode: formData.get('mode'),
        location: formData.get('location') || '',
        meetingLink: formData.get('meetingLink') || 'https://meet.google.com/' + Math.random().toString(36).substring(7),
        round: formData.get('round'),
        panel: [{
          userId: user?._id,
          name: `${user?.firstName} ${user?.lastName}`,
          email: user?.email,
          role: user?.role,
        }],
      });
      
      setMessage({ type: 'success', text: 'Interview scheduled successfully! View it in the Interviews section.' });
      setShowScheduleModal(false);
      
      // Update application status to interview_scheduled
      await updateStatus('interview_scheduled');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to schedule interview',
      });
    } finally {
      setScheduling(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      applied: 'bg-blue-100 text-blue-800',
      shortlisted: 'bg-yellow-100 text-yellow-800',
      interview_scheduled: 'bg-purple-100 text-purple-800',
      in_progress: 'bg-indigo-100 text-indigo-800',
      selected: 'bg-green-100 text-green-800',
      hired: 'bg-green-200 text-green-900',
      offer_released: 'bg-teal-100 text-teal-800',
      rejected: 'bg-red-100 text-red-800',
      on_hold: 'bg-gray-100 text-gray-800',
      withdrawn: 'bg-gray-200 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Application not found</h2>
        <button
          onClick={() => navigate('/applications')}
          className="mt-4 text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Applications
        </button>
      </div>
    );
  }

  const isEmployer = user?.role === 'employer' || user?.role === 'hr' || user?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/applications')}
        className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Applications
      </button>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            {message.type === 'success' && message.text.includes('Interview scheduled') && (
              <Link
                to="/interviews"
                className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
              >
                View Interviews
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{application.job?.title}</h1>
              {isEmployer && application.candidate && (
                <div className="mt-2 space-y-1">
                  <p className="text-lg text-gray-700">
                    {application.candidate.firstName} {application.candidate.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{application.candidate.email}</p>
                  {application.candidate.phone && (
                    <p className="text-sm text-gray-600">{application.candidate.phone}</p>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Applied on {new Date(application.appliedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
              {application.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Scores (for employer) */}
        {isEmployer && (application.skillMatchScore || application.experienceMatchScore || application.overallScore) && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Match Scores</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {application.skillMatchScore !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Skill Match</p>
                  <p className="text-2xl font-bold text-indigo-600">{application.skillMatchScore}%</p>
                </div>
              )}
              {application.experienceMatchScore !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Experience Match</p>
                  <p className="text-2xl font-bold text-indigo-600">{application.experienceMatchScore}%</p>
                </div>
              )}
              {application.overallScore !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Overall Score</p>
                  <p className="text-2xl font-bold text-indigo-600">{application.overallScore}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cover Letter */}
        {application.coverLetter && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Cover Letter</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{application.coverLetter}</p>
          </div>
        )}

        {/* Resume */}
        {application.resume && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Resume</h2>
            <div className="space-y-4">
              {/* Download Button */}
              <a
                href={application.resume}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Resume
              </a>

              {/* Preview for employers */}
              {isEmployer && (
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700">Resume Preview</h3>
                  </div>
                  {application.resume.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={application.resume}
                      className="w-full h-96"
                      title="Resume Preview"
                    />
                  ) : (
                    <div className="p-4 bg-gray-50">
                      <p className="text-sm text-gray-600">
                        Preview not available for this file type. Please download to view.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions (for employer) */}
        {isEmployer && (
          <div className="p-6 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            
            {/* Schedule Interview Button */}
            {(application.status === 'shortlisted' || application.status === 'applied') && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="mb-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule Interview
              </button>
            )}

            <h3 className="text-md font-semibold text-gray-900 mb-3 mt-4">Update Status</h3>
            <div className="flex flex-wrap gap-2">
              {['shortlisted', 'interview_scheduled', 'in_progress', 'selected', 'hired', 'offer_released', 'rejected', 'on_hold'].map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  disabled={updating || application.status === status}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    application.status === status
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                  }`}
                >
                  {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Schedule Interview</h2>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleScheduleInterview} className="p-6">
              <div className="space-y-4">
                {/* Candidate Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Candidate</h3>
                  <p className="text-gray-700">
                    {application.candidate?.firstName} {application.candidate?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{application.candidate?.email}</p>
                </div>

                {/* Job Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Position</h3>
                  <p className="text-gray-700">{application.job?.title}</p>
                </div>

                {/* Interview Round */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Round *
                  </label>
                  <select
                    name="round"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="L1">Round 1 - Technical Screening</option>
                    <option value="L2">Round 2 - System Design</option>
                    <option value="L3">Round 3 - Behavioral</option>
                    <option value="final">Final Round</option>
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      name="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time *
                    </label>
                    <input
                      type="time"
                      name="time"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes) *
                  </label>
                  <select
                    name="duration"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Mode *
                  </label>
                  <select
                    name="mode"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="online">Video Call</option>
                    <option value="in_person">In-Person</option>
                    <option value="phone">Phone Call</option>
                  </select>
                </div>

                {/* Location (for in-person) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location / Meeting Link
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="Office address or leave blank for auto-generated link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Meeting Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link (optional)
                  </label>
                  <input
                    type="url"
                    name="meetingLink"
                    placeholder="https://meet.google.com/... (auto-generated if empty)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave blank to auto-generate a meeting link
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Interview'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
