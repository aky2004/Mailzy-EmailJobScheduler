// ─── API Types ────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  dbId: string;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export type CampaignStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'paused';
export type JobStatus = 'pending' | 'sent' | 'failed' | 'rate_limited' | 'cancelled';

export interface Campaign {
  id: string;
  subject: string;
  totalRecipients: number;
  scheduledAt: string;
  status: CampaignStatus;
  delayBetweenMs: number;
  hourlyLimit: number;
  createdAt: string;
  completedAt?: string;
  senderEmail?: string;
  senderName?: string;
}

export interface CampaignDetail extends Campaign {
  body: string;
}

export interface EmailJob {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  status: JobStatus;
  scheduledAt: string;
  sentAt?: string;
  previewUrl?: string;
  errorMessage?: string;
  isStarred?: boolean;
  isDeleted?: boolean;
  isRead?: boolean;
  hasAttachments?: boolean;
  messageId?: string;
  campaignSubject?: string;
  campaignId: string;
  senderEmail?: string;
  senderName?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedCampaigns {
  campaigns: Campaign[];
  pagination: Pagination;
}

export interface PaginatedJobs {
  jobs: EmailJob[];
  pagination: Pagination;
}

export interface PaginatedSenders {
  senders: Sender[];
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface Recipient {
  email: string;
  name?: string;
}

export interface CreateCampaignPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: Recipient[];
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit: number;
  hasAttachments?: boolean;
}

export interface CreateSenderPayload {
  name: string;
}
