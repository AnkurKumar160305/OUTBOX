export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface ScheduledEmailItem {
  id: string;
  campaignId?: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  scheduledAt: string;
  sentAt?: string | null;
  failedReason?: string | null;
  jobId?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardStats {
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  rateLimitedCount: number;
  rateLimitEvents: number;
  defaultSender: string;
}

export interface SlackStatus {
  connected: boolean;
  channel: string | null;
  webhookMasked: string | null;
  updatedAt?: string;
}

export interface SearchResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  engine: 'elasticsearch' | 'database_fallback';
  items: ScheduledEmailItem[];
}
