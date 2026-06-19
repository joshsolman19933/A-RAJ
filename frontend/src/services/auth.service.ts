import axios from 'axios';
import type { LoginResponse } from '@a-raj/shared';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('araj_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('araj_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await api.post<LoginResponse>('/auth/refresh', {
          refreshToken,
        });

        localStorage.setItem('araj_token', data.token);
        localStorage.setItem('araj_refresh_token', data.refreshToken);
        localStorage.setItem('araj_user', JSON.stringify(data.user));

        pendingRequests.forEach((cb) => cb(data.token));
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('araj_token');
        localStorage.removeItem('araj_refresh_token');
        localStorage.removeItem('araj_user');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Auth service
export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      username,
      password,
    });
    return data;
  },

  async register(username: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/register', {
      username,
      password,
    });
    return data;
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
