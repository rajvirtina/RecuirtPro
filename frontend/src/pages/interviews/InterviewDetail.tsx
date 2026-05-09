import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface InterviewDetail {
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
  proctoringEnabled?: boolean;
  round?: string;
  panel?: any[];
  notes?: string;
  feedback?: any[];
  finalDecision?: 'selected' | 'rejected' | 'on_hold';
  overallRating?: number;
}

export default function InterviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [systemCheckCompleted, setSystemCheckCompleted] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    rating: 3,
    comments: '',
    recommendation: 'neutral' as 'strong_hire' | 'hire' | 'neutral' | 'no_hire' | 'strong_no_hire',
    nextRoundDecision: '' as 'selected' | 'rejected' | 'on_hold' | '',
  });

  useEffect(() => {
    fetchInterviewDetail();
    checkSystemCheckStatus();
  }, [id]);

  const checkSystemCheckStatus = async () => {
    // Check if candidate has completed system check for this interview
    try {
      const response = await apiClient.get(`/proctoring/system-check/${id}`);
      if (response.data?.data?.systemCheckPassed) {
        setSystemCheckCompleted(true);
      }
    } catch (error) {
      // System check not completed yet
      setSystemCheckCompleted(false);
    }
  };

  const fetchInterviewDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/interviews/${id}`);
      console.log('Interview API response:', response);
      console.log('Interview data:', response.data);
      console.log('Feedback array:', response.data?.feedback);
      console.log('Final decision:', response.data?.finalDecision);
      setInterview(response.data as any);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load interview details',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to mark this interview as ${newStatus}?`)) return;

    try {
      setUpdating(true);
      
      // Use DELETE endpoint for cancellation
      if (newStatus === 'cancelled') {
        const reason = prompt('Please provide a reason for cancellation (optional):');
        await apiClient.delete(`/interviews/${id}`, {
          data: { reason: reason || 'Cancelled by interviewer' }
        });
      } else {
        // Use PUT endpoint for other status updates
        await apiClient.put(`/interviews/${id}/status`, { status: newStatus });
      }
      
      setMessage({ type: 'success', text: 'Status updated successfully!' });
      await fetchInterviewDetail();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update status',
      });
    } finally {
      setUpdating(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackData.comments.trim()) {
      setMessage({ type: 'error', text: 'Please provide feedback comments' });
      return;
    }

    if (!feedbackData.nextRoundDecision) {
      setMessage({ type: 'error', text: 'Please select a decision for next round consideration' });
      return;
    }

    try {
      setUpdating(true);
      await apiClient.post(`/interviews/${id}/feedback`, {
        rating: feedbackData.rating,
        comments: feedbackData.comments,
        recommendation: feedbackData.recommendation,
        finalDecision: feedbackData.nextRoundDecision,
      });
      
      setMessage({ type: 'success', text: 'Feedback submitted successfully!' });
      setShowFeedbackForm(false);
      setFeedbackData({
        rating: 3,
        comments: '',
        recommendation: 'neutral',
        nextRoundDecision: '',
      });
      await fetchInterviewDetail();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to submit feedback',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-purple-100 text-purple-800',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
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

  if (!interview) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Interview not found</h2>
        <button
          onClick={() => navigate('/interviews')}
          className="mt-4 text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Interviews
        </button>
      </div>
    );
  }

  const datetime = formatDateTime(interview.scheduledTime);
  const upcoming = isUpcoming(interview.scheduledTime);
  const isEmployer = user?.role === 'employer' || user?.role === 'admin' || user?.role === 'hr';

  console.log('User role:', user?.role);
  console.log('Interview status:', interview.status);
  console.log('Is Employer/HR/Admin:', isEmployer);
  console.log('Should show feedback form:', isEmployer && (interview.status === 'completed' || interview.status === 'in_progress'));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/interviews')}
        className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Interviews
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
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{interview.job?.title}</h1>
              {interview.round && (
                <p className="mt-1 text-gray-600">{interview.round}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
              {interview.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {isEmployer && interview.candidate && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-500 mb-1">Candidate</h2>
              <p className="text-lg text-gray-900">
                {interview.candidate.firstName} {interview.candidate.lastName}
              </p>
              <p className="text-sm text-gray-600">{interview.candidate.email}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-1">Date</h2>
              <p className="text-gray-900">{datetime.date}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-1">Time</h2>
              <p className="text-gray-900">{datetime.time}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-1">Duration</h2>
              <p className="text-gray-900">{interview.duration} minutes</p>
            </div>
            {interview.job?.location && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-1">Location</h2>
                <p className="text-gray-900">{interview.job.location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Meeting Link */}
        {interview.meetingLink && (
          <div className="p-6 border-b border-gray-200 bg-indigo-50">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Meeting Link</h2>
            
            {/* System Check Warning for Candidates */}
            {user?.role === 'candidate' && !systemCheckCompleted && upcoming && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">System Check Required</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      You must complete the system check before joining the interview.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* For HR/Employer/Admin: Direct meeting link */}
              {(user?.role === 'hr' || user?.role === 'employer' || user?.role === 'admin') && (
                <Link
                  to={`/interviews/${id}/room`}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-center transition-colors"
                >
                  {upcoming ? 'Join Meeting' : 'View Meeting Link'}
                </Link>
              )}

              {/* For Candidates: System check required first if proctoring enabled */}
              {user?.role === 'candidate' && (
                <>
                  {interview?.proctoringEnabled && !systemCheckCompleted && upcoming ? (
                    <button
                      disabled
                      className="flex-1 px-4 py-3 bg-gray-300 text-gray-500 rounded-lg font-medium text-center cursor-not-allowed"
                      title="Complete system check first"
                    >
                      Join Meeting (System Check Required)
                    </button>
                  ) : (
                    <Link
                      to={interview?.proctoringEnabled && !systemCheckCompleted ? `/proctoring-check/${id}` : `/interviews/${id}/room`}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-center transition-colors"
                    >
                      {upcoming ? 'Join Meeting' : 'View Meeting Link'}
                    </Link>
                  )}
                  {interview?.proctoringEnabled && (
                    <Link
                      to={`/proctoring-check/${id}`}
                      className="px-4 py-3 bg-white text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
                    >
                      {systemCheckCompleted ? 'Recheck System' : 'System Check'}
                    </Link>
                  )}
                </>
              )}
            </div>
            
            {/* System Check Success Message */}
            {user?.role === 'candidate' && systemCheckCompleted && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs text-green-700 font-medium">
                    ✓ System check completed - You can join the interview
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel Members */}
        {interview.panel && interview.panel.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Interview Panel</h2>
            <div className="space-y-2">
              {interview.panel.map((member: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-medium">
                      {member.name?.charAt(0) || 'P'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.name || 'Panel Member'}</p>
                    {member.email && (
                      <p className="text-sm text-gray-600">{member.email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {interview.notes && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{interview.notes}</p>
          </div>
        )}

        {/* Feedback - Full details for HR/Employer/Admin only */}
        {isEmployer && interview.feedback && Array.isArray(interview.feedback) && interview.feedback.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interview Feedback</h2>
            <div className="space-y-4">
              {interview.feedback.map((fb: any, idx: number) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-gray-900">Rating: </span>
                      <span className="text-yellow-500">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span>
                      <span className="text-gray-600 ml-2">({fb.rating}/5)</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(fb.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  {fb.recommendation && (
                    <div className="mb-2">
                      <span className="font-medium text-gray-700">Recommendation: </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        fb.recommendation === 'strong_hire' ? 'bg-green-100 text-green-800' :
                        fb.recommendation === 'hire' ? 'bg-green-50 text-green-700' :
                        fb.recommendation === 'neutral' ? 'bg-gray-100 text-gray-700' :
                        fb.recommendation === 'no_hire' ? 'bg-red-50 text-red-700' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {fb.recommendation.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  )}
                  {fb.comments && (
                    <p className="text-gray-700 whitespace-pre-wrap">{fb.comments}</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* Overall Rating & Final Decision */}
            {(interview.overallRating || interview.finalDecision) && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {interview.overallRating && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Overall Rating: </span>
                      <span className="text-lg font-bold text-indigo-600">
                        {interview.overallRating.toFixed(1)} / 5.0
                      </span>
                    </div>
                  )}
                  {interview.finalDecision && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Next Round Decision: </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        interview.finalDecision === 'selected' ? 'bg-green-100 text-green-800' :
                        interview.finalDecision === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {interview.finalDecision === 'selected' ? '✓ Selected for Next Round' :
                         interview.finalDecision === 'on_hold' ? '⏸ On Hold' :
                         '✗ Not Selected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Round Decision - For Candidates only (no detailed feedback) */}
        {!isEmployer && interview.finalDecision && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interview Result</h2>
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200 text-center">
              <p className="text-sm font-medium text-gray-700 mb-3">Next Round Decision</p>
              <div className={`inline-block px-6 py-3 rounded-full text-lg font-bold ${
                interview.finalDecision === 'selected' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                interview.finalDecision === 'on_hold' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                'bg-red-100 text-red-800 border-2 border-red-300'
              }`}>
                {interview.finalDecision === 'selected' ? '🎉 Congratulations! You have been selected for the next round' :
                 interview.finalDecision === 'on_hold' ? '⏸ Your application is currently on hold. We will update you soon.' :
                 '❌ Thank you for your time. Unfortunately, we will not be proceeding further.'}
              </div>
              {interview.finalDecision === 'selected' && (
                <p className="mt-4 text-sm text-gray-600">
                  Our team will contact you soon with details about the next round.
                </p>
              )}
            </div>
          </div>
        )}

        {/* HR Feedback Form */}
        {isEmployer && (interview.status === 'completed' || interview.status === 'in_progress' || interview.status === 'confirmed') && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Interview Feedback & Next Round Decision</h2>
              {!showFeedbackForm && (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Add Feedback
                </button>
              )}
            </div>

            {showFeedbackForm && (
              <div className="space-y-4 bg-white p-5 rounded-lg border border-gray-200">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating (1-5 stars)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackData({ ...feedbackData, rating: star })}
                        className={`text-3xl ${
                          star <= feedbackData.rating ? 'text-yellow-400' : 'text-gray-300'
                        } hover:text-yellow-400 transition-colors`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="ml-2 text-gray-600 self-center">
                      {feedbackData.rating} / 5
                    </span>
                  </div>
                </div>

                {/* Recommendation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendation
                  </label>
                  <select
                    value={feedbackData.recommendation}
                    onChange={(e) => setFeedbackData({ ...feedbackData, recommendation: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="strong_hire">Strong Hire</option>
                    <option value="hire">Hire</option>
                    <option value="neutral">Neutral</option>
                    <option value="no_hire">No Hire</option>
                    <option value="strong_no_hire">Strong No Hire</option>
                  </select>
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback Comments
                  </label>
                  <textarea
                    value={feedbackData.comments}
                    onChange={(e) => setFeedbackData({ ...feedbackData, comments: e.target.value })}
                    rows={4}
                    placeholder="Provide detailed feedback about the candidate's performance..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Next Round Decision */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Consider for Next Round? <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="nextRoundDecision"
                        value="selected"
                        checked={feedbackData.nextRoundDecision === 'selected'}
                        onChange={(e) => setFeedbackData({ ...feedbackData, nextRoundDecision: e.target.value as any })}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div>
                        <span className="font-medium text-green-700">✓ Selected for Next Round</span>
                        <p className="text-xs text-gray-600">Candidate will proceed to the next interview round</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="nextRoundDecision"
                        value="on_hold"
                        checked={feedbackData.nextRoundDecision === 'on_hold'}
                        onChange={(e) => setFeedbackData({ ...feedbackData, nextRoundDecision: e.target.value as any })}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div>
                        <span className="font-medium text-yellow-700">⏸ On Hold</span>
                        <p className="text-xs text-gray-600">Decision pending, need more evaluation</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="nextRoundDecision"
                        value="rejected"
                        checked={feedbackData.nextRoundDecision === 'rejected'}
                        onChange={(e) => setFeedbackData({ ...feedbackData, nextRoundDecision: e.target.value as any })}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div>
                        <span className="font-medium text-red-700">✗ Not Selected</span>
                        <p className="text-xs text-gray-600">Candidate will not proceed to next round</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={submitFeedback}
                    disabled={updating}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    {updating ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                  <button
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setFeedbackData({
                        rating: 3,
                        comments: '',
                        recommendation: 'neutral',
                        nextRoundDecision: '',
                      });
                    }}
                    disabled={updating}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-6 bg-gray-50">
          <div className="flex flex-wrap gap-3">
            {/* Removed duplicate Join Interview buttons - now handled in Meeting Information section above */}

            {isEmployer && interview.status === 'scheduled' && (
              <>
                <button
                  onClick={() => updateStatus('confirmed')}
                  disabled={updating}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => updateStatus('in_progress')}
                  disabled={updating}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Start Interview
                </button>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={updating}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Mark as Completed
                </button>
                <button
                  onClick={() => updateStatus('rescheduled')}
                  disabled={updating}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={updating}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {isEmployer && interview.status === 'confirmed' && (
              <>
                <button
                  onClick={() => updateStatus('in_progress')}
                  disabled={updating}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Start Interview
                </button>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={updating}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Mark as Completed
                </button>
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={updating}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {isEmployer && interview.status === 'in_progress' && (
              <button
                onClick={() => updateStatus('completed')}
                disabled={updating}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                Mark as Completed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
