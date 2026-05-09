import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';

/**
 * LLM Service Client — calls the Python LLM microservice for AI features.
 * Endpoints: /api/schedule, /api/feedback, /api/candidate-message
 */
class LLMServiceClient {
  private client: AxiosInstance;
  private available: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: config.llm.serviceUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.llm.apiSecretKey,
      },
    });

    // Check availability on startup
    this.checkHealth();
  }

  private async checkHealth(): Promise<void> {
    try {
      const res = await this.client.get('/health');
      this.available = res.data?.status === 'healthy';
      if (this.available) {
        logger.info(`LLM Service connected at ${config.llm.serviceUrl}`);
      }
    } catch {
      this.available = false;
      logger.warn(`LLM Service unavailable at ${config.llm.serviceUrl} — AI features will use fallbacks`);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Schedule Interview — find optimal slot between HR and candidate availability
   */
  async scheduleInterview(data: {
    hr_availability: string[];
    candidate_availability: string[];
    interview_type: string;
    duration_minutes?: number;
  }): Promise<{
    success: boolean;
    selected_slot?: string;
    email_subject?: string;
    email_body?: string;
    error?: string;
  }> {
    if (!this.available) {
      // Fallback: pick first overlapping slot
      const overlap = data.hr_availability.find(s => data.candidate_availability.includes(s));
      return {
        success: !!overlap,
        selected_slot: overlap || data.hr_availability[0],
        email_subject: `${data.interview_type} Interview Scheduled`,
        email_body: `Your ${data.interview_type} interview has been scheduled.`,
      };
    }

    try {
      const res = await this.client.post('/api/schedule', data);
      return res.data;
    } catch (error: any) {
      logger.error('LLM schedule error:', error.message);
      return { success: false, error: 'LLM service unavailable' };
    }
  }

  /**
   * Analyze Interview Feedback — parse raw notes into structured evaluation
   */
  async analyzeFeedback(data: {
    role: string;
    interview_type: string;
    raw_feedback: string;
  }): Promise<{
    success: boolean;
    structured_feedback?: any;
    overall_score?: number;
    recommendation?: string;
    error?: string;
  }> {
    if (!this.available) {
      return {
        success: true,
        structured_feedback: { notes: data.raw_feedback },
        overall_score: 0,
        recommendation: 'Manual review required — LLM service not available',
      };
    }

    try {
      const res = await this.client.post('/api/feedback', data);
      return res.data;
    } catch (error: any) {
      logger.error('LLM feedback error:', error.message);
      return { success: false, error: 'LLM service unavailable' };
    }
  }

  /**
   * Generate Candidate Communication — produce external-safe message based on evaluation
   */
  async generateCandidateMessage(data: {
    evaluation_summary: string;
    outcome: 'offer' | 'hold' | 'reject';
    candidate_name?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    subject?: string;
    error?: string;
  }> {
    if (!this.available) {
      const templates: Record<string, string> = {
        offer: `Dear ${data.candidate_name || 'Candidate'}, we are pleased to inform you that you have been selected. Our HR team will reach out with the next steps.`,
        hold: `Dear ${data.candidate_name || 'Candidate'}, thank you for your time. We are currently reviewing all candidates and will update you shortly.`,
        reject: `Dear ${data.candidate_name || 'Candidate'}, thank you for your interest. After careful consideration, we have decided to move forward with other candidates.`,
      };
      return {
        success: true,
        subject: `Application Update — ${data.outcome === 'offer' ? 'Congratulations!' : 'Application Status'}`,
        message: templates[data.outcome] || templates.hold,
      };
    }

    try {
      const res = await this.client.post('/api/candidate-message', data);
      return res.data;
    } catch (error: any) {
      logger.error('LLM message error:', error.message);
      return { success: false, error: 'LLM service unavailable' };
    }
  }

  /**
   * AI-powered semantic matching for sourcing — uses embeddings when LLM is available
   */
  async semanticMatch(data: {
    candidate_skills: string[];
    job_requirements: string[];
    candidate_summary?: string;
    job_description?: string;
  }): Promise<{ score: number; analysis?: string }> {
    if (!this.available) {
      // Keyword-based fallback
      const overlap = data.candidate_skills.filter(s =>
        data.job_requirements.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
      );
      return { score: Math.round((overlap.length / Math.max(data.job_requirements.length, 1)) * 100) };
    }

    try {
      const res = await this.client.post('/api/semantic-match', data);
      return res.data;
    } catch {
      const overlap = data.candidate_skills.filter(s =>
        data.job_requirements.some(r => r.toLowerCase().includes(s.toLowerCase()))
      );
      return { score: Math.round((overlap.length / Math.max(data.job_requirements.length, 1)) * 100) };
    }
  }
}

export const llmClient = new LLMServiceClient();
