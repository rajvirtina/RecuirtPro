import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface Interview {
  _id: string;
  job?: {
    title: string;
  };
  candidate?: {
    firstName: string;
    lastName: string;
  };
  meetingLink?: string;
  scheduledTime: string;
  duration: number;
  status: string;
  round?: string;
  proctoringEnabled?: boolean;
}

// Detect meeting platform from URL
const detectMeetingPlatform = (url: string): string => {
  if (!url) return 'unknown';
  
  const urlLower = url.toLowerCase();
  if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) {
    return 'teams';
  } else if (urlLower.includes('meet.google.com') || urlLower.includes('hangouts.google.com')) {
    return 'meet';
  } else if (urlLower.includes('zoom.us') || urlLower.includes('zoom.com')) {
    return 'zoom';
  } else if (urlLower.includes('webex.com')) {
    return 'webex';
  } else if (urlLower.includes('zoho.com/meeting')) {
    return 'zoho';
  }
  return 'other';
};

// Convert meeting link to embeddable format
const getEmbedUrl = (url: string, platform: string): string | null => {
  if (!url) return null;
  
  try {
    switch (platform) {
      case 'teams':
        // Teams meetings can be embedded
        return url;
        
      case 'meet':
        // Google Meet doesn't support iframe embedding due to X-Frame-Options
        // We'll show the link in a special way
        return null;
        
      case 'zoom':
        // Zoom web client - some meetings can be embedded
        if (url.includes('/j/')) {
          return url;
        }
        return null;
        
      case 'webex':
        // Webex can sometimes be embedded
        return url;
        
      case 'zoho':
        // Zoho Meeting
        return url;
        
      default:
        return url;
    }
  } catch (error) {
    console.error('Error getting embed URL:', error);
    return null;
  }
};

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [embedSupported, setEmbedSupported] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    if (id) {
      fetchInterview();
    }
  }, [id]);

  const fetchInterview = async () => {
    try {
      const response = await apiClient.get(`/interviews/${id}`);
      if (response.success && response.data) {
        setInterview(response.data);
        
        const meetingUrl = response.data.meetingLink;
        if (meetingUrl) {
          const detectedPlatform = detectMeetingPlatform(meetingUrl);
          setPlatform(detectedPlatform);
          
          const embedUrl = getEmbedUrl(meetingUrl, detectedPlatform);
          setEmbedSupported(!!embedUrl);
        }
      } else {
        setError('Failed to load interview details');
      }
    } catch (err: any) {
      console.error('Error fetching interview:', err);
      setError(err.response?.data?.message || 'Failed to load interview');
    } finally {
      setLoading(false);
    }
  };

  const handleEndInterview = () => {
    if (confirm('Are you sure you want to end the interview?')) {
      navigate('/interviews');
    }
  };

  const getPlatformName = (platform: string): string => {
    const names: Record<string, string> = {
      teams: 'Microsoft Teams',
      meet: 'Google Meet',
      zoom: 'Zoom',
      webex: 'Cisco Webex',
      zoho: 'Zoho Meeting',
      other: 'External Platform'
    };
    return names[platform] || 'Meeting Platform';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview room...</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="text-red-600 text-xl mb-4">⚠️ {error || 'Interview not found'}</div>
          <button
            onClick={() => navigate('/interviews')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Interviews
          </button>
        </div>
      </div>
    );
  }

  const jobTitle = interview.job?.title || 'Interview';
  const candidateName = interview.candidate 
    ? `${interview.candidate.firstName} ${interview.candidate.lastName}`
    : 'Candidate';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{jobTitle}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {user?.role !== 'candidate' && `${candidateName} • `}
              {interview.round && `${interview.round} • `}
              Duration: {interview.duration} minutes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              Platform: {getPlatformName(platform)}
            </span>
            <button
              onClick={handleEndInterview}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Interview
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {interview.meetingLink ? (
          embedSupported && platform !== 'meet' ? (
            // Embedded iframe for supported platforms
            <iframe
              src={interview.meetingLink}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen; speaker; display-capture"
              allowFullScreen
              title={`${getPlatformName(platform)} Meeting`}
            />
          ) : (
            // Fallback for platforms that don't support embedding (Google Meet, etc.)
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="max-w-2xl w-full bg-gray-800 rounded-lg p-8 text-center">
                <div className="mb-6">
                  <svg className="h-24 w-24 text-indigo-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-2xl font-bold text-white mb-2">Join {getPlatformName(platform)} Meeting</h2>
                  <p className="text-gray-400">
                    {platform === 'meet' 
                      ? 'Google Meet meetings cannot be embedded for security reasons.'
                      : `This ${getPlatformName(platform)} meeting needs to be opened in a new window.`}
                  </p>
                </div>

                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-2">Meeting Link:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={interview.meetingLink}
                      readOnly
                      className="flex-1 bg-gray-600 text-gray-200 px-4 py-2 rounded text-sm"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(interview.meetingLink || '')}
                      className="px-3 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-500 transition-colors text-sm"
                      title="Copy link"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <a
                  href={interview.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-lg font-medium"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Meeting in New Window
                </a>

                <p className="text-xs text-gray-500 mt-4">
                  The meeting will open in a new window. Please allow popups if blocked.
                </p>

                {/* Instructions */}
                <div className="mt-8 text-left bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Interview Guidelines</h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>Ensure your camera and microphone are working properly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>Find a quiet, well-lit space for the interview</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>Keep the meeting window visible at all times</span>
                    </li>
                    {interview.proctoringEnabled && (
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">⚠</span>
                        <span className="text-yellow-200">This interview is being recorded and monitored</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )
        ) : (
          // No meeting link provided
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center max-w-md">
              <svg className="h-24 w-24 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-white mb-2">No Meeting Link</h2>
              <p className="text-gray-400">
                The interview organizer has not provided a meeting link yet.
                Please contact the interviewer or check back later.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
