import axios from 'axios';
import { ScheduledEmailItem, DashboardStats, SlackStatus, SearchResult, User } from '../types';

const BACKEND_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, '')}/api` : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach user auth token from localStorage if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  googleLogin: async (credential?: string, userInfo?: any): Promise<{ user: User; token: string }> => {
    const res = await apiClient.post('/auth/google', { credential, userInfo });
    return res.data;
  },
  demoLogin: async (): Promise<{ user: User; token: string }> => {
    const res = await apiClient.post('/auth/demo');
    return res.data;
  },

  // Dashboard Stats
  getStats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get('/dashboard/stats');
    return res.data;
  },

  // Emails
  getScheduledEmails: async (page = 1, limit = 10): Promise<{ total: number; totalPages: number; items: ScheduledEmailItem[] }> => {
    const res = await apiClient.get('/emails/scheduled', { params: { page, limit } });
    return res.data;
  },

  getSentEmails: async (page = 1, limit = 10): Promise<{ total: number; totalPages: number; items: ScheduledEmailItem[] }> => {
    const res = await apiClient.get('/emails/sent', { params: { page, limit } });
    return res.data;
  },

  searchEmails: async (query: string, status?: string, page = 1, limit = 15): Promise<SearchResult> => {
    const res = await apiClient.get('/emails/search', { params: { q: query, status, page, limit } });
    return res.data;
  },

  scheduleEmails: async (data: {
    senderEmail: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayBetweenEmails: number;
    hourlyLimit: number;
  }) => {
    const res = await apiClient.post('/emails/schedule', data);
    return res.data;
  },

  cancelScheduledEmail: async (id: string) => {
    const res = await apiClient.delete(`/emails/${id}`);
    return res.data;
  },

  // Slack
  getSlackStatus: async (): Promise<SlackStatus> => {
    const res = await apiClient.get('/slack/status');
    return res.data;
  },

  connectSlack: async (webhookUrl: string, channel?: string) => {
    const res = await apiClient.post('/slack/connect', { webhookUrl, channel });
    return res.data;
  },

  disconnectSlack: async () => {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },

  testSlackAlert: async (webhookUrl?: string) => {
    const res = await apiClient.post('/slack/test', { webhookUrl });
    return res.data;
  },
};
