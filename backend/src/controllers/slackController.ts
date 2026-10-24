import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { slackService } from '../services/slackService';
import axios from 'axios';
import { z } from 'zod';

const ConnectSlackSchema = z.object({
  webhookUrl: z.string().url('Must be a valid Slack Webhook URL').optional(),
  channel: z.string().optional(),
});

export class SlackController {
  /**
   * Get the current user's Slack connection status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const config = await prisma.slackConfig.findUnique({
        where: { userId },
      });

      if (!config || !config.isActive) {
        res.json({
          connected: false,
          channel: null,
          webhookMasked: null,
        });
        return;
      }

      const masked = config.webhookUrl
        ? config.webhookUrl.replace(/^(https:\/\/hooks\.slack\.com\/services\/[^\/]+\/[^\/]+\/).+$/, '$1••••••••')
        : null;

      res.json({
        connected: true,
        channel: config.channel || '#email-alerts',
        webhookMasked: masked,
        updatedAt: config.updatedAt,
      });
    } catch (error) {
      console.error('❌ Error getting Slack status:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Connect or update Slack webhook
   */
  public static async connect(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const parsed = ConnectSlackSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const { webhookUrl, channel } = parsed.data;

      // Ensure user exists
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: 'demo@reachinbox.ai',
          name: 'ReachInbox Demo User',
        },
      });

      const config = await prisma.slackConfig.upsert({
        where: { userId },
        update: {
          webhookUrl,
          channel: channel || '#email-alerts',
          isActive: true,
        },
        create: {
          userId,
          webhookUrl,
          channel: channel || '#email-alerts',
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: 'Slack alerts connected successfully! Real-time notifications are now active.',
        channel: config.channel,
      });
    } catch (error) {
      console.error('❌ Error connecting Slack:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Disconnect Slack
   */
  public static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      await prisma.slackConfig.updateMany({
        where: { userId },
        data: { isActive: false, webhookUrl: null, botToken: null },
      });

      res.json({ success: true, message: 'Slack disconnected successfully' });
    } catch (error) {
      console.error('❌ Error disconnecting Slack:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Test Slack Notification
   */
  public static async testNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'demo-user-id';
      const { webhookUrl } = req.body;

      let targetUrl = webhookUrl;
      if (!targetUrl) {
        const config = await prisma.slackConfig.findUnique({ where: { userId } });
        targetUrl = config?.webhookUrl || process.env.DEFAULT_SLACK_WEBHOOK_URL;
      }

      if (!targetUrl) {
        res.status(400).json({ error: 'No Slack webhook URL provided or configured' });
        return;
      }

      await slackService.sendTestAlert(targetUrl);
      res.json({ success: true, message: 'Test alert sent to Slack successfully!' });
    } catch (error) {
      console.error('❌ Error testing Slack alert:', error);
      res.status(500).json({ error: 'Failed to deliver test alert to Slack: ' + (error as Error).message });
    }
  }

  /**
   * OAuth Callback for Slack App install
   */
  public static async oauthCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.query;
      if (!code) {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=error`);
        return;
      }

      const clientId = process.env.SLACK_CLIENT_ID;
      const clientSecret = process.env.SLACK_CLIENT_SECRET;
      const redirectUri = process.env.SLACK_REDIRECT_URI;

      if (!clientId || !clientSecret) {
        res.status(400).send('Slack OAuth client credentials not configured in backend .env');
        return;
      }

      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: redirectUri || '',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      if (response.data.ok) {
        const userId = 'demo-user-id';
        const incomingWebhook = response.data.incoming_webhook?.url;
        const botToken = response.data.access_token;
        const channel = response.data.incoming_webhook?.channel;

        await prisma.slackConfig.upsert({
          where: { userId },
          update: {
            webhookUrl: incomingWebhook || null,
            botToken: botToken || null,
            channel: channel || '#general',
            isActive: true,
          },
          create: {
            userId,
            webhookUrl: incomingWebhook || null,
            botToken: botToken || null,
            channel: channel || '#general',
            isActive: true,
          },
        });

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=success`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=failed`);
      }
    } catch (error) {
      console.error('❌ Slack OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=error`);
    }
  }
}
