import axios from 'axios';
import { prisma } from '../config/db';

export interface RateLimitAlertOptions {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  delayedUntil: Date;
  rescheduledCount?: number;
}

class SlackService {
  /**
   * Dispatches a real-time Slack alert when a sender's hourly rate limit is reached.
   * If Slack is not connected, gracefully skips without throwing or failing.
   */
  public async notifyRateLimitHit(options: RateLimitAlertOptions): Promise<{ success: boolean; reason?: string }> {
    try {
      // 1. Look up user's active Slack configuration in DB
      const slackConfig = await prisma.slackConfig.findUnique({
        where: { userId: options.userId },
      });

      const fallbackWebhook = process.env.DEFAULT_SLACK_WEBHOOK_URL;
      const targetWebhook = slackConfig?.isActive && slackConfig.webhookUrl ? slackConfig.webhookUrl : fallbackWebhook;

      if (!targetWebhook && !slackConfig?.botToken) {
        console.log(`ℹ️ [Slack] User ${options.userId} has not connected Slack. Skipping notification without error.`);
        return { success: false, reason: 'slack_not_connected' };
      }

      const formattedResumeTime = options.delayedUntil.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ ReachInbox Alert: Sender Hourly Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Attention:* Outbound emails for sender *${options.senderEmail}* have reached the configured hourly throttle limit.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender Email:*\n\`${options.senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${options.hourlyLimit} emails / hour`,
            },
            {
              type: 'mrkdwn',
              text: `*Sent in Current Window:*\n${options.currentCount} emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Sending Window:*\n*${formattedResumeTime}*`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🛡️ *Zero Dropped Jobs:* Pending jobs are automatically delayed to the next window while preserving order.`,
            },
          ],
        },
      ];

      // Send to Slack via Webhook or Bot Token
      if (targetWebhook) {
        console.log(`🚀 [Slack] Dispatching live rate-limit alert to Slack webhook...`);
        const response = await axios.post(
          targetWebhook,
          {
            text: `⚠️ Rate limit reached for ${options.senderEmail}: ${options.currentCount}/${options.hourlyLimit} sent. Rescheduled to ${formattedResumeTime}.`,
            blocks,
          },
          { timeout: 5000 }
        );

        if (response.status === 200) {
          console.log(`✅ [Slack] Alert successfully delivered to Slack!`);
          return { success: true };
        }
      } else if (slackConfig?.botToken && slackConfig?.channel) {
        console.log(`🚀 [Slack] Dispatching live rate-limit alert via Slack Web API (chat.postMessage)...`);
        const response = await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: slackConfig.channel,
            text: `⚠️ Rate limit reached for ${options.senderEmail}`,
            blocks,
          },
          {
            headers: {
              Authorization: `Bearer ${slackConfig.botToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );

        if (response.data.ok) {
          console.log(`✅ [Slack] Alert delivered to channel ${slackConfig.channel}!`);
          return { success: true };
        }
      }

      return { success: false, reason: 'slack_send_failed' };
    } catch (error) {
      console.error('❌ [Slack] Error sending rate limit notification:', (error as Error).message);
      // Never crash or fail worker job due to Slack notification issue
      return { success: false, reason: (error as Error).message };
    }
  }

  /**
   * Send a test ping notification to verify user's Slack webhook/token
   */
  public async sendTestAlert(targetWebhook: string): Promise<boolean> {
    try {
      const response = await axios.post(
        targetWebhook,
        {
          text: '🎉 ReachInbox Email Scheduler: Slack connection verified successfully!',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚀 ReachInbox Slack Integration Connected',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Your Slack notifications are now configured! You will receive real-time alerts whenever a sender hits their hourly email rate limit.',
              },
            },
          ],
        },
        { timeout: 5000 }
      );
      return response.status === 200;
    } catch (err) {
      console.error('❌ [Slack] Test alert failed:', (err as Error).message);
      throw err;
    }
  }
}

export const slackService = new SlackService();
