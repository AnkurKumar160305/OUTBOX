import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { prisma } from '../config/db';
import { EMAIL_QUEUE_NAME, EmailJobData } from './emailQueue';
import { RateLimiter } from './rateLimiter';
import { etherealService } from '../services/etherealService';
import { searchService } from '../services/searchService';
import { slackService } from '../services/slackService';
import dotenv from 'dotenv';

dotenv.config();

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const minDelayMs = parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10);
const defaultHourlyLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);

console.log(`⚙️ [BullMQ Worker] Initializing with Concurrency: ${concurrency}, Min Delay: ${minDelayMs}ms, Default Hourly Limit: ${defaultHourlyLimit}`);

/**
 * Utility helper to enforce provider delay
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { emailId, userId, senderEmail, recipientEmail, subject, body, hourlyLimit, delayBetweenEmails } = job.data;

    console.log(`⚡ [Worker] Processing job [${job.id}] for recipient: ${recipientEmail} from sender: ${senderEmail}`);

    // 1. Idempotency Check in Database
    const emailRecord = await prisma.scheduledEmail.findUnique({
      where: { id: emailId },
    });

    if (!emailRecord) {
      console.warn(`⚠️ [Worker] Email record [${emailId}] not found in database. Skipping job.`);
      return { status: 'skipped', reason: 'not_found' };
    }

    if (emailRecord.status === 'SENT') {
      console.log(`ℹ️ [Worker] Email [${emailId}] is already SENT. Skipping to preserve idempotency.`);
      return { status: 'already_sent', emailId };
    }

    // 2. Rate Limiting Check (Redis-backed atomic sliding window counter)
    const effectiveLimit = hourlyLimit || defaultHourlyLimit;
    const rateLimitResult = await RateLimiter.checkAndReserveSlot(senderEmail, effectiveLimit);

    if (!rateLimitResult.allowed) {
      const delayMs = rateLimitResult.delayMs || 3600000;
      const resumeDate = rateLimitResult.resumeDate || new Date(Date.now() + delayMs);

      console.warn(
        `🚨 [Worker Rate Limit] Sender [${senderEmail}] reached hourly limit of ${effectiveLimit} emails! Rescheduling job [${job.id}] by ${Math.round(delayMs / 1000)}s to ${resumeDate.toISOString()}`
      );

      // Update record status in DB to RATE_LIMITED with updated scheduledAt
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'RATE_LIMITED',
          scheduledAt: resumeDate,
        },
      });

      // Log the rate limit event in DB
      await prisma.rateLimitEvent.create({
        data: {
          senderEmail,
          hourWindow: RateLimiter.getHourWindow(),
          emailsInWindow: rateLimitResult.currentCount,
          maxLimit: effectiveLimit,
          rescheduledJobsCount: 1,
          delayedUntil: resumeDate,
          notifiedSlack: !!rateLimitResult.shouldNotifySlack,
        },
      });

      // Dispatch Slack notification if this is the first hit in the current hour window
      if (rateLimitResult.shouldNotifySlack) {
        console.log(`🔔 [Worker] Triggering Slack rate-limit alert for sender: ${senderEmail}`);
        await slackService.notifyRateLimitHit({
          userId,
          senderEmail,
          hourlyLimit: effectiveLimit,
          currentCount: rateLimitResult.currentCount,
          delayedUntil: resumeDate,
        });
      }

      // Re-schedule the job into BullMQ for the next available hour window (DO NOT DROP)
      // Throwing a custom delayed reschedule error so BullMQ handles backoff/delay or moveToDelayed
      await job.moveToDelayed(Date.now() + delayMs, job.token);
      return {
        status: 'rescheduled',
        reason: 'rate_limit_exceeded',
        delayedUntil: resumeDate.toISOString(),
      };
    }

    // 3. Mark state as PROCESSING in DB
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: { status: 'PROCESSING' },
    });

    // 4. Enforce provider throttle delay
    const effectiveDelay = Math.max(minDelayMs, (delayBetweenEmails || 0) * 1000);
    if (effectiveDelay > 0) {
      await sleep(effectiveDelay);
    }

    // 5. Send Email via Ethereal SMTP
    try {
      const sendResult = await etherealService.sendMail({
        from: senderEmail,
        to: recipientEmail,
        subject,
        text: body,
      });

      const sentTime = new Date();

      // 6. Persist SENT state in Database
      const updated = await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: sentTime,
          etherealPreviewUrl: sendResult.previewUrl || null,
        },
      });

      // 7. Index in Elasticsearch for real-time search
      await searchService.indexEmail({
        id: updated.id,
        userId: updated.userId,
        senderEmail: updated.senderEmail,
        recipientEmail: updated.recipientEmail,
        subject: updated.subject,
        body: updated.body,
        status: 'SENT',
        scheduledAt: updated.scheduledAt,
        sentAt: sentTime,
        etherealPreviewUrl: sendResult.previewUrl || null,
        createdAt: updated.createdAt,
      });

      console.log(`🎉 [Worker] Successfully sent email [${emailId}] to [${recipientEmail}]! Preview: ${sendResult.previewUrl || 'N/A'}`);

      return {
        status: 'sent',
        emailId,
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
      };
    } catch (sendError) {
      console.error(`❌ [Worker] Failed to send email [${emailId}]:`, (sendError as Error).message);

      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          failedReason: (sendError as Error).message,
        },
      });

      throw sendError;
    }
  },
  {
    connection: redisConfig,
    concurrency,
    limiter: {
      max: 10,
      duration: 1000, // Safety limiter: max 10 jobs per second per worker instance
    },
  }
);

emailWorker.on('completed', (job: Job) => {
  console.log(`✅ [BullMQ Worker] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`❌ [BullMQ Worker] Job ${job?.id} failed with error:`, err.message);
});

emailWorker.on('error', (err: Error) => {
  console.error('❌ [BullMQ Worker Error]:', err.message);
});
