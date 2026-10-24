import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { scheduleEmailJob, cancelEmailJob } from '../queue/emailQueue';
import { searchService } from '../services/searchService';
import { etherealService } from '../services/etherealService';
import { z } from 'zod';

const ScheduleEmailSchema = z.object({
  senderEmail: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  startTime: z.string().optional(),
  delayBetweenEmails: z.number().min(0).default(2),
  hourlyLimit: z.number().min(1).default(50),
});

export class EmailController {
  /**
   * Schedules a single email or batch/campaign of emails
   */
  public static async scheduleEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const parsed = ScheduleEmailSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { senderEmail, subject, body, recipients, startTime, delayBetweenEmails, hourlyLimit } = parsed.data;

      // Ensure user exists in DB
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            email: 'demo@reachinbox.ai',
            name: 'ReachInbox Demo User',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=reachinbox',
          },
        });
      }

      const start = startTime ? new Date(startTime) : new Date();

      // Create Campaign container
      const campaign = await prisma.campaign.create({
        data: {
          userId: user.id,
          title: subject.slice(0, 50),
          senderEmail,
          subject,
          body,
          totalRecipients: recipients.length,
          delayBetweenEmails,
          hourlyLimit,
          startTime: start,
        },
      });

      const scheduledList = [];

      // Create email records and schedule them sequentially with delay
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        // Calculate scheduled time for this recipient based on delay
        const recipientScheduledTime = new Date(start.getTime() + i * delayBetweenEmails * 1000);

        const emailRecord = await prisma.scheduledEmail.create({
          data: {
            campaignId: campaign.id,
            userId: user.id,
            senderEmail,
            recipientEmail: recipient,
            subject,
            body,
            status: 'SCHEDULED',
            scheduledAt: recipientScheduledTime,
          },
        });

        // Enqueue delayed job in BullMQ
        const jobId = await scheduleEmailJob(
          {
            emailId: emailRecord.id,
            userId: user.id,
            campaignId: campaign.id,
            senderEmail,
            recipientEmail: recipient,
            subject,
            body,
            scheduledAt: recipientScheduledTime.toISOString(),
            hourlyLimit,
            delayBetweenEmails,
            sequenceIndex: i,
          },
          recipientScheduledTime
        );

        // Update record with BullMQ Job ID
        const updated = await prisma.scheduledEmail.update({
          where: { id: emailRecord.id },
          data: { jobId },
        });

        // Index in Elasticsearch
        await searchService.indexEmail({
          id: updated.id,
          userId: user.id,
          senderEmail: updated.senderEmail,
          recipientEmail: updated.recipientEmail,
          subject: updated.subject,
          body: updated.body,
          status: 'SCHEDULED',
          scheduledAt: recipientScheduledTime,
          createdAt: updated.createdAt,
        });

        scheduledList.push(updated);
      }

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${recipients.length} email(s)`,
        campaignId: campaign.id,
        count: scheduledList.length,
        items: scheduledList,
      });
    } catch (error) {
      console.error('❌ Error scheduling emails:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Fetches scheduled / pending emails
   */
  public static async getScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const offset = (page - 1) * limit;

      const where = {
        userId,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      };

      const [total, items] = await Promise.all([
        prisma.scheduledEmail.count({ where }),
        prisma.scheduledEmail.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { scheduledAt: 'asc' },
        }),
      ]);

      res.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        items,
      });
    } catch (error) {
      console.error('❌ Error fetching scheduled emails:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Fetches sent / completed emails
   */
  public static async getSentEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const offset = (page - 1) * limit;

      const where = {
        userId,
        status: { in: ['SENT', 'FAILED'] },
      };

      const [total, items] = await Promise.all([
        prisma.scheduledEmail.count({ where }),
        prisma.scheduledEmail.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { sentAt: 'desc' },
        }),
      ]);

      res.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        items,
      });
    } catch (error) {
      console.error('❌ Error fetching sent emails:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Full-text search across emails via Elasticsearch (with DB fallback)
   */
  public static async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      const results = await searchService.searchEmails({
        userId,
        query,
        status,
        page,
        limit,
      });

      res.json(results);
    } catch (error) {
      console.error('❌ Error searching emails:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Cancels a scheduled email job
   */
  public static async cancelScheduledEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const email = await prisma.scheduledEmail.findUnique({ where: { id } });

      if (!email) {
        res.status(404).json({ error: 'Scheduled email not found' });
        return;
      }

      if (email.status === 'SENT') {
        res.status(400).json({ error: 'Cannot cancel an email that is already sent' });
        return;
      }

      if (email.jobId) {
        await cancelEmailJob(email.jobId);
      }

      await prisma.scheduledEmail.delete({ where: { id } });

      res.json({ success: true, message: 'Email schedule cancelled and removed successfully' });
    } catch (error) {
      console.error('❌ Error canceling email:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * System & User Dashboard Statistics
   */
  public static async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';

      const [scheduledCount, sentCount, failedCount, rateLimitedCount, rateLimitEvents] = await Promise.all([
        prisma.scheduledEmail.count({
          where: { userId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
        }),
        prisma.scheduledEmail.count({
          where: { userId, status: 'SENT' },
        }),
        prisma.scheduledEmail.count({
          where: { userId, status: 'FAILED' },
        }),
        prisma.scheduledEmail.count({
          where: { userId, status: 'RATE_LIMITED' },
        }),
        prisma.rateLimitEvent.count(),
      ]);

      const defaultSender = await etherealService.getSenderEmail();

      res.json({
        scheduledCount,
        sentCount,
        failedCount,
        rateLimitedCount,
        rateLimitEvents,
        defaultSender,
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
