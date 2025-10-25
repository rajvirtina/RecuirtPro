/**
 * API Client
 * Handles HTTP communication with backend API
 */

import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

export class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        log.info(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        log.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        log.info(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        log.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async reportViolation(data: {
    interviewId: string;
    eventType: string;
    metadata: Record<string, any>;
  }) {
    try {
      const response = await this.client.post('/proctoring/event', {
        interviewId: data.interviewId,
        eventType: data.eventType,
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      });
      return response.data;
    } catch (error) {
      log.error('Error reporting violation:', error);
      throw error;
    }
  }

  async heartbeat(data: { interviewId: string; status: string }) {
    try {
      const response = await this.client.post('/proctoring/heartbeat', {
        interviewId: data.interviewId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      log.error('Error sending heartbeat:', error);
      throw error;
    }
  }

  async getInterviewStatus(interviewId: string) {
    try {
      const response = await this.client.get(`/interviews/${interviewId}/status`);
      return response.data;
    } catch (error) {
      log.error('Error getting interview status:', error);
      throw error;
    }
  }
}
