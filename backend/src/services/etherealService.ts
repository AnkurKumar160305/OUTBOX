import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendResult {
  messageId: string;
  previewUrl: string | false;
  accepted: string[];
}

class EtherealService {
  private transporter: Transporter | null = null;
  private testAccount: nodemailer.TestAccount | null = null;
  private isInitializing: Promise<void> | null = null;

  constructor() {
    this.isInitializing = this.initTransporter();
  }

  private async initTransporter(): Promise<void> {
    try {
      if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: process.env.ETHEREAL_USER,
            pass: process.env.ETHEREAL_PASS,
          },
        });
        console.log(`✅ Using configured Ethereal account: ${process.env.ETHEREAL_USER}`);
      } else {
        console.log('⏳ Creating new Ethereal test account...');
        this.testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: this.testAccount.user,
            pass: this.testAccount.pass,
          },
        });
        console.log(`✅ Ethereal test account generated: ${this.testAccount.user}`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Ethereal SMTP transporter:', error);
      throw error;
    }
  }

  public async getSenderEmail(): Promise<string> {
    if (this.isInitializing) await this.isInitializing;
    return this.testAccount?.user || process.env.ETHEREAL_USER || 'reachinbox.sender@ethereal.email';
  }

  public async sendMail(payload: EmailPayload): Promise<SendResult> {
    if (this.isInitializing) await this.isInitializing;
    if (!this.transporter) throw new Error('Transporter not initialized');

    const info = await this.transporter.sendMail({
      from: `"${payload.from.split('@')[0]}" <${payload.from}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text || payload.html?.replace(/<[^>]*>?/gm, '') || payload.subject,
      html: payload.html || `<div style="font-family:sans-serif;padding:20px;color:#1e293b;">
        <h2 style="color:#4f46e5;">ReachInbox Outreach</h2>
        <div style="margin-top:12px;font-size:15px;line-height:1.6;">${payload.text ? payload.text.replace(/\n/g, '<br/>') : ''}</div>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;"/>
        <p style="font-size:12px;color:#64748b;">Sent via ReachInbox Email Scheduler • Powered by Outbox Labs</p>
      </div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📧 Email delivered to [${payload.to}] | MessageID: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      accepted: (info.accepted as string[]) || [payload.to],
    };
  }
}

export const etherealService = new EtherealService();
