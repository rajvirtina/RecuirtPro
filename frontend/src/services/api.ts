import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import config from '../config';
import { ApiResponse } from '../types';

/** Read the CSRF token from the non-httpOnly cookie set by the server (BUG-009) */
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      withCredentials: true, // BUG-001: send httpOnly cookies with every request
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor — attach Bearer token (fallback) + CSRF header
    this.client.interceptors.request.use((cfg) => {
      // BUG-001: prefer cookie auth; also attach Bearer for API/mobile clients
      const token = localStorage.getItem('token');
      if (token) {
        cfg.headers.Authorization = `Bearer ${token}`;
      }
      // BUG-009: CSRF token in header for state-changing requests
      const csrf = getCsrfToken();
      if (csrf) {
        cfg.headers['X-CSRF-Token'] = csrf;
      }
      return cfg;
    });

    // Response interceptor — silent token refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          if (this.isRefreshing) {
            // Queue callers while a refresh is in progress
            return new Promise((resolve) => {
              this.refreshQueue.push((token: string) => {
                original.headers.Authorization = `Bearer ${token}`;
                resolve(this.client.request(original));
              });
            });
          }

          this.isRefreshing = true;
          try {
            // BUG-001: refresh endpoint reads httpOnly cookie automatically
            const refreshToken = localStorage.getItem('refreshToken');
            const res = await axios.post(
              `${config.apiUrl}/auth/refresh`,
              refreshToken ? { refreshToken } : {},
              { withCredentials: true },
            );
            const { accessToken } = res.data.data ?? res.data;

            if (accessToken) {
              localStorage.setItem('token', accessToken);
              original.headers.Authorization = `Bearer ${accessToken}`;
              this.refreshQueue.forEach((cb) => cb(accessToken));
            }

            return this.client.request(original);
          } catch {
            // Refresh failed — clear local state and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          } finally {
            this.isRefreshing = false;
            this.refreshQueue = [];
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r: AxiosResponse<ApiResponse<T>> = await this.client.get(url, cfg);
    return r.data;
  }

  async post<T = any>(url: string, data?: any, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, cfg);
    return r.data;
  }

  async put<T = any>(url: string, data?: any, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, cfg);
    return r.data;
  }

  async patch<T = any>(url: string, data?: any, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data, cfg);
    return r.data;
  }

  async delete<T = any>(url: string, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, cfg);
    return r.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
