import apiClient from './api';
import { AuthResponse, LoginCredentials, RegisterData, User } from '../types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', credentials);
    const { accessToken, refreshToken, user } = response.data as any;
    
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    
    return {
      token: accessToken,
      refreshToken,
      user,
    };
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/register', data);
    const { accessToken, refreshToken, user } = response.data as any;
    
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    
    return {
      token: accessToken,
      refreshToken,
      user,
    };
  },

  async logout(): Promise<void> {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    await apiClient.post('/auth/logout');
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return (response.data as any).user;
  },

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const response = await apiClient.post<{ token: string }>('/auth/refresh', {
      refreshToken,
    });
    return response.data!;
  },

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  },
};
