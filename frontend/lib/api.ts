import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { auth } from './firebase';
import type {
  Campaign,
  PaginatedCampaigns,
  PaginatedJobs,
  PaginatedSenders,
  CreateCampaignPayload,
  CreateSenderPayload,
  Sender,
  User,
  QueueStats,
  CampaignDetail,
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Firebase ID token into every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authApi = {
  getMe: (): Promise<User> => api.get('/api/auth/me').then((r) => r.data),
};

// Senders
export const sendersApi = {
  list: (): Promise<PaginatedSenders> => api.get('/api/senders').then((r) => r.data),
  create: (data: CreateSenderPayload): Promise<{ sender: Sender }> =>
    api.post('/api/senders', data).then((r) => r.data),
};

// Campaigns
export const campaignsApi = {
  list: (page = 1, limit = 20): Promise<PaginatedCampaigns> =>
    api.get('/api/campaigns', { params: { page, limit } }).then((r) => r.data),
  get: (id: string): Promise<{ campaign: CampaignDetail }> =>
    api.get(`/api/campaigns/${id}`).then((r) => r.data),
  create: (data: CreateCampaignPayload): Promise<{ campaign: Campaign; message: string }> =>
    api.post('/api/campaigns', data).then((r) => r.data),
  getJobs: (id: string, page = 1, limit = 50) =>
    api.get(`/api/campaigns/${id}/jobs`, { params: { page, limit } }).then((r) => r.data),
};

// Jobs
export const jobsApi = {
  scheduled: (page = 1, limit = 50): Promise<PaginatedJobs> =>
    api.get('/api/jobs/scheduled', { params: { page, limit } }).then((r) => r.data),
  sent: (page = 1, limit = 50): Promise<PaginatedJobs> =>
    api.get('/api/jobs/sent', { params: { page, limit } }).then((r) => r.data),
  stats: (): Promise<{ queue: QueueStats }> =>
    api.get('/api/jobs/stats').then((r) => r.data),
};

export default api;
