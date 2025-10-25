/**
 * Real-time Proctoring Violations Dashboard
 * Displays live violations from ongoing interviews
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import apiClient from '../../services/api';

interface Violation {
  _id: string;
  interviewId: {
    _id: string;
    candidateId: {
      firstName: string;
      lastName: string;
      email: string;
    };
    scheduledTime: string;
  };
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  metadata?: {
    processName?: string;
    count?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    details?: string;
  };
  reviewed: boolean;
}

interface Interview {
  _id: string;
  candidateId: {
    firstName: string;
    lastName: string;
    email: string;
  };
  status: string;
  scheduledTime: string;
  violations?: number;
}

export default function ProctoringDashboard() {
  const [activeInterviews, setActiveInterviews] = useState<Interview[]>([]);
  const [recentViolations, setRecentViolations] = useState<Violation[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<string | null>(null);
  const [interviewEvents, setInterviewEvents] = useState<Violation[]>([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    totalViolations: 0,
    criticalViolations: 0,
    unreviewedViolations: 0,
  });

  useEffect(() => {
    loadDashboardData();
    
    // Initialize WebSocket connection
    const token = localStorage.getItem('token');
    const socketInstance = io('http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('Connected to proctoring socket');
    });

    socketInstance.on('violation', (data) => {
      console.log('Real-time violation received:', data);
      handleNewViolation(data);
    });

    socketInstance.on('interview-terminated', (data) => {
      console.log('Interview terminated:', data);
      handleInterviewTermination(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load active interviews
      const interviewsRes = await apiClient.get('/interviews?status=in-progress');
      setActiveInterviews(interviewsRes.data.data.interviews || []);

      // Load recent violations
      const violationsRes = await apiClient.get('/proctoring/events/recent?limit=20');
      setRecentViolations(violationsRes.data.data || []);

      // Calculate stats
      const active = interviewsRes.data.data.interviews?.length || 0;
      const violations = violationsRes.data.data || [];
      
      setStats({
        totalActive: active,
        totalViolations: violations.length,
        criticalViolations: violations.filter((v: Violation) => v.severity === 'critical').length,
        unreviewedViolations: violations.filter((v: Violation) => !v.reviewed).length,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewViolation = (data: any) => {
    // Add to recent violations
    setRecentViolations((prev) => [data.violation, ...prev.slice(0, 19)]);
    
    // Update stats
    setStats((prev) => ({
      ...prev,
      totalViolations: prev.totalViolations + 1,
      criticalViolations: data.violation.severity === 'critical' ? prev.criticalViolations + 1 : prev.criticalViolations,
      unreviewedViolations: prev.unreviewedViolations + 1,
    }));

    // Show notification
    if (data.violation.severity === 'critical') {
      showNotification('Critical Violation Detected', data.violation.description);
    }
  };

  const handleInterviewTermination = (data: any) => {
    // Remove from active interviews
    setActiveInterviews((prev) => prev.filter((i) => i._id !== data.interviewId));
    
    // Update stats
    setStats((prev) => ({
      ...prev,
      totalActive: prev.totalActive - 1,
    }));

    showNotification('Interview Terminated', `Interview ${data.interviewId} has been terminated`);
  };

  const showNotification = (title: string, message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  };

  const loadInterviewEvents = async (interviewId: string) => {
    try {
      const res = await apiClient.get(`/proctoring/events/${interviewId}`);
      setInterviewEvents(res.data.data.events || []);
      setSelectedInterview(interviewId);
    } catch (error) {
      console.error('Error loading interview events:', error);
    }
  };

  const reviewViolation = async (eventId: string, comments: string) => {
    try {
      await apiClient.put(`/proctoring/event/${eventId}/review`, {
        reviewComments: comments,
      });
      
      // Refresh data
      loadDashboardData();
      if (selectedInterview) {
        loadInterviewEvents(selectedInterview);
      }
    } catch (error) {
      console.error('Error reviewing violation:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      'unauthorized_app': '🚫 Prohibited App',
      'multiple_browser_tabs': '🌐 Multiple Browsers',
      'multiple_displays': '🖥️ Multiple Displays',
      'tab_switch': '🔄 Tab Switch',
      'window_blur': '👁️ Window Focus Lost',
      'system_resource_issue': '⚠️ System Resources',
      'multiple_faces': '👥 Multiple Faces',
      'no_face_detected': '❌ No Face Detected',
      'gaze_away': '👀 Looking Away',
      'audio_issue': '🔇 Audio Issue',
      'video_issue': '📹 Video Issue',
    };
    return labels[eventType] || eventType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-time Proctoring Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live monitoring of all active interviews
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-3 w-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {socket?.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Interviews</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalActive}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Violations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalViolations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-red-100 rounded-full p-3">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Critical Violations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.criticalViolations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unreviewed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.unreviewedViolations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Interviews */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Active Interviews</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {activeInterviews.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No active interviews
              </div>
            ) : (
              activeInterviews.map((interview) => (
                <div
                  key={interview._id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadInterviewEvents(interview._id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {interview.candidateId?.firstName} {interview.candidateId?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{interview.candidateId?.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Started: {new Date(interview.scheduledTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        interview.status === 'in-progress' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {interview.status}
                      </span>
                      {interview.violations && interview.violations > 0 && (
                        <p className="text-sm text-red-600 font-medium mt-1">
                          {interview.violations} violation{interview.violations > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Violations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Violations</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {recentViolations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No violations detected
              </div>
            ) : (
              recentViolations.map((violation) => (
                <div key={violation._id} className={`p-4 border-l-4 ${getSeverityColor(violation.severity)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {getEventTypeLabel(violation.eventType)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                          {violation.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{violation.description}</p>
                      {violation.metadata?.details && (
                        <p className="text-xs text-gray-500 mt-1">{violation.metadata.details}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(violation.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!violation.reviewed && (
                      <button
                        onClick={() => {
                          const comments = prompt('Review comments:');
                          if (comments) reviewViolation(violation._id, comments);
                        }}
                        className="ml-4 text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Interview Details Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Interview Events</h2>
              <button
                onClick={() => setSelectedInterview(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {interviewEvents.map((event) => (
                  <div key={event._id} className={`p-4 rounded-lg border-2 ${getSeverityColor(event.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{getEventTypeLabel(event.eventType)}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                          {event.reviewed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              ✓ Reviewed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                        {event.metadata?.processName && (
                          <p className="text-xs text-gray-600 mt-1">Process: {event.metadata.processName}</p>
                        )}
                        {event.metadata?.details && (
                          <p className="text-xs text-gray-600 mt-1">{event.metadata.details}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!event.reviewed && (
                        <button
                          onClick={() => {
                            const comments = prompt('Review comments:');
                            if (comments) reviewViolation(event._id, comments);
                          }}
                          className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
