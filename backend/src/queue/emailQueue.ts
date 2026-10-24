import { Queue, JobsOptions } from 'bullmq';
import { redisConfig } from '../config/redis';

export interface EmailJobData {
  emailId: string;
  userId: string;
  campaignId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  hourlyLimit: number;
  delayBetweenEmails: number;
  sequenceIndex?: number;
}

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: { age: 86400 * 7, count: 5000 },
    removeOnFail: { age: 86400 * 7, count: 5000 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('❌ BullMQ Queue Error:', err.message);
});

/**
 * Schedules a delayed email job in BullMQ.
 * Computes exact delay milliseconds without cron jobs.
 * Uses emailId as BullMQ jobId for guaranteed idempotency.
 */
export async function scheduleEmailJob(
  jobData: EmailJobData,
  scheduledTime: Date,
  staggerDelaySeconds: number = 0
): Promise<string> {
  const now = Date.now();
  const targetTime = scheduledTime.getTime() + staggerDelaySeconds * 1000;
  const delayMs = Math.max(0, targetTime - now);

  const jobOptions: JobsOptions = {
    jobId: jobData.emailId, // Idempotency key matching DB record ID
    delay: delayMs,
  };

  const job = await emailQueue.add('send-email', jobData, jobOptions);
  console.log(`📦 [BullMQ] Scheduled job [${job.id}] for [${jobData.recipientEmail}] in ${Math.round(delayMs / 1000)}s`);
  return job.id as string;
}

/**
 * Removes a job from the queue if canceled
 */
export async function cancelEmailJob(jobId: string): Promise<boolean> {
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`🗑️ [BullMQ] Removed job [${jobId}] from queue.`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`⚠️ [BullMQ] Failed to cancel job [${jobId}]:`, (err as Error).message);
    return false;
  }
}
