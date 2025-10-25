import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface Interview {
  _id: string;
  job: {
    title: string;
    location?: string;
  };
  candidate?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  scheduledTime: string;
  duration: number;
  status: string;
  meetingLink?: string;
  panel: any[];
  proctoringEnabled?: boolean;
}

export default function Interviews() {
  const user = useAuthStore((state) => state.user);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchInterviews = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/interviews' : `/interviews?status=${filter}`;
      const response = await apiClient.get(url);
      console.log('Interviews API response:', response);
      setInterviews((response.data as any) || []);
    } catch (error) {
      console.error('Failed to fetch interviews:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleCancelInterview = async (interviewId: string) => {
    if (!confirm('Are you sure you want to cancel this interview? This action cannot be undone.')) {
      return;
    }

    const reason = prompt('Please provide a reason for cancellation (optional):');

    try {
      await apiClient.delete(`/interviews/${interviewId}`, {
        data: { reason: reason || 'Cancelled by interviewer' }
      });
      setMessage({ type: 'success', text: 'Interview cancelled successfully!' });
      // Refresh the interviews list
      await fetchInterviews();
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to cancel interview'
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {user?.role === 'candidate' ? 'My Interviews' : 'Interview Schedule'}
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage interview appointments
        </p>
      </div>

      {/* Success/Error Message */}
      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'scheduled', 'in_progress', 'completed', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>

      {interviews.length === 0 ? (
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No interviews found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {user?.role === 'candidate'
              ? 'No scheduled interviews yet'
              : 'No interviews have been scheduled'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => {
            const datetime = formatDateTime(interview.scheduledTime);
            const upcoming = isUpcoming(interview.scheduledTime);

            return (
              <div
                key={interview._id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {interview.job?.title || 'Interview'}
                        </h2>
                        {user?.role !== 'candidate' && interview.candidate && (
                          <p className="mt-1 text-sm text-gray-600">
                            Candidate: {interview.candidate.firstName} {interview.candidate.lastName}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {datetime.date}
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {datetime.time}
                          </span>
                          <span>{interview.duration} mins</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                        {interview.status.replace('_', ' ')}
                      </span>
                    </div>

                    {interview.panel && interview.panel.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600">
                          Panel: {interview.panel.length} interviewer{interview.panel.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {/* For HR/Employer/Admin: Direct meeting link */}
                  {upcoming && (user?.role === 'hr' || user?.role === 'employer' || user?.role === 'admin') && interview.meetingLink && (
                    <Link
                      to={`/interviews/${interview._id}/room`}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      Join Interview
                    </Link>
                  )}
                  
                  {/* For Candidates: System check required */}
                  {upcoming && user?.role === 'candidate' && (
                    <Link
                      to={`/proctoring-check/${interview._id}`}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      System Check & Join
                    </Link>
                  )}
                  
                  <Link
                    to={`/interviews/${interview._id}`}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    View Details
                  </Link>
                  {user?.role !== 'candidate' && interview.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancelInterview(interview._id)}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

