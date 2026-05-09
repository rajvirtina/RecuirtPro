/**
 * React Frontend Integration Example
 * Hooks and API client for LLM service
 */

import axios, { AxiosInstance } from 'axios';
import { useState, useCallback } from 'react';

// ========== Types ==========

// Extend ImportMeta for Vite env types
declare global {
  interface ImportMetaEnv {
    VITE_LLM_SERVICE_URL?: string;
    VITE_LLM_API_KEY?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

interface ScheduleRequest {
  hr_availability: string[];
  candidate_availability: string[];
  interview_type: string;
  duration_minutes?: number;
}

interface ScheduleResponse {
  success: boolean;
  selected_slot?: string;
  email_subject?: string;
  email_body?: string;
  error?: string;
}

interface FeedbackRequest {
  role: string;
  interview_type: string;
  raw_feedback: string;
}

interface FeedbackResponse {
  success: boolean;
  technical_skills?: number;
  communication?: number;
  problem_solving?: number;
  strengths?: string[];
  weaknesses?: string[];
  final_recommendation?: string;
  confidence_level?: string;
  error?: string;
}

// ========== API Client ==========

class LLMServiceAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_LLM_SERVICE_URL || 'http://localhost:8001',
      headers: {
        'X-API-Key': import.meta.env.VITE_LLM_API_KEY || 'default-secret-key',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async scheduleInterview(data: ScheduleRequest): Promise<ScheduleResponse> {
    const response = await this.client.post('/api/schedule-interview', data);
    return response.data;
  }

  async analyzeFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
    const response = await this.client.post('/api/analyze-feedback', data);
    return response.data;
  }

  async generateCandidateMessage(data: {
    evaluation_summary: string;
    outcome: 'offer' | 'hold' | 'reject';
    candidate_name?: string;
  }) {
    const response = await this.client.post('/api/candidate-message', data);
    return response.data;
  }
}

export const llmService = new LLMServiceAPI();

// ========== React Hooks ==========

export function useInterviewScheduling() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);

  const scheduleInterview = useCallback(async (data: ScheduleRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await llmService.scheduleInterview(data);
      setResult(response);
      return response;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { scheduleInterview, loading, error, result };
}

export function useFeedbackAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FeedbackResponse | null>(null);

  const analyzeFeedback = useCallback(async (data: FeedbackRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await llmService.analyzeFeedback(data);
      setAnalysis(response);
      return response;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyzeFeedback, loading, error, analysis };
}

// ========== Example Component ==========

export function InterviewScheduler() {
  const { scheduleInterview, loading, error, result } = useInterviewScheduling();

  const handleSchedule = async () => {
    try {
      await scheduleInterview({
        hr_availability: ['2026-01-20T10:00:00Z', '2026-01-20T14:00:00Z'],
        candidate_availability: ['2026-01-20T10:00:00Z', '2026-01-21T09:00:00Z'],
        interview_type: 'Technical',
        duration_minutes: 60,
      });
    } catch (err) {
      console.error('Scheduling failed:', err);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={handleSchedule}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Scheduling...' : 'Schedule Interview'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {result?.success && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <h3 className="font-bold">Interview Scheduled!</h3>
          <p>Time: {result.selected_slot}</p>
          <p>Subject: {result.email_subject}</p>
          <pre className="mt-2 text-sm">{result.email_body}</pre>
        </div>
      )}
    </div>
  );
}
