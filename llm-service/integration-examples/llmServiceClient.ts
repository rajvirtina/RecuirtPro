/**
 * TypeScript/Node.js Integration Example for RecruitPro Backend
 * This service client handles communication with the LLM microservice
 */

import axios, { AxiosInstance } from 'axios';

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

interface CandidateMessageRequest {
  evaluation_summary: string;
  outcome: 'offer' | 'hold' | 'reject';
  candidate_name?: string;
}

interface MessageResponse {
  success: boolean;
  candidate_message?: string;
  error?: string;
}

export class LLMServiceClient {
  private client: AxiosInstance;

  constructor(
    baseURL: string = process.env.LLM_SERVICE_URL || 'http://localhost:8001',
    apiKey: string = process.env.LLM_API_KEY || 'default-secret-key'
  ) {
    this.client = axios.create({
      baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Schedule an interview with AI-powered slot selection
   */
  async scheduleInterview(data: ScheduleRequest): Promise<ScheduleResponse> {
    try {
      const response = await this.client.post<ScheduleResponse>(
        '/api/schedule-interview',
        data
      );
      return response.data;
    } catch (error) {
      console.error('LLM Service - Schedule Interview Error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Analyze interview feedback and generate structured evaluation
   */
  async analyzeFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
    try {
      const response = await this.client.post<FeedbackResponse>(
        '/api/analyze-feedback',
        data
      );
      return response.data;
    } catch (error) {
      console.error('LLM Service - Analyze Feedback Error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate candidate-facing communication message
   */
  async generateCandidateMessage(
    data: CandidateMessageRequest
  ): Promise<MessageResponse> {
    try {
      const response = await this.client.post<MessageResponse>(
        '/api/candidate-message',
        data
      );
      return response.data;
    } catch (error) {
      console.error('LLM Service - Generate Message Error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; llm_configured: boolean }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('LLM Service - Health Check Error:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return new Error(
          `LLM Service Error: ${error.response.status} - ${
            error.response.data?.error || error.message
          }`
        );
      } else if (error.request) {
        return new Error('LLM Service: No response received');
      }
    }
    return new Error(`LLM Service: ${error.message}`);
  }
}

// Example usage in your controllers
export async function handleInterviewScheduling(req: any, res: any) {
  const llmService = new LLMServiceClient();

  try {
    const result = await llmService.scheduleInterview({
      hr_availability: req.body.hr_availability,
      candidate_availability: req.body.candidate_availability,
      interview_type: req.body.interview_type,
      duration_minutes: req.body.duration_minutes,
    });

    if (result.success) {
      // Save to database, send email, etc.
      return res.json({
        success: true,
        data: result,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
