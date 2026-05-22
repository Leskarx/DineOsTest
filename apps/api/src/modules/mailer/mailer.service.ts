import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { welcomeTemplate } from './templates/welcome.template';
import { passwordResetTemplate } from './templates/password-reset.template';
import { shiftSummaryTemplate } from './templates/shift-summary.template';
import { billTemplate } from './templates/bill.template';
import { trialExpiryTemplate } from './templates/trial-expiry.template';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.from = config.get('SMTP_FROM', 'noreply@dinestay.app');
    const host = config.get('SMTP_HOST');
    const pass = config.get('SMTP_PASS');
    this.enabled = !!(host && pass && pass !== 'xxxxx');

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT', 587),
        secure: config.get<number>('SMTP_PORT', 587) === 465,
        auth: {
          user: config.get('SMTP_USER', 'apikey'),
          pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
      this.verifyConnection();
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  private async verifyConnection() {
    try {
      await this.transporter!.verify();
      this.logger.log('SMTP connection verified');
    } catch (err) {
      this.logger.error('SMTP connection failed', err);
    }
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const toList = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    if (!this.enabled || !this.transporter) {
      this.logger.log(`[MAIL PREVIEW] To: ${toList} | Subject: ${options.subject}`);
      return true;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: toList,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        attachments: options.attachments,
      });
      this.logger.log(`Email sent to ${toList} | messageId: ${info.messageId}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${toList}`, err);
      return false;
    }
  }

  // ─── Templated helpers ────────────────────────────────────────────────────

  async sendWelcome(opts: { to: string; businessName: string; ownerName: string; trialEndsAt: Date }) {
    return this.send({
      to: opts.to,
      subject: `Welcome to Dine&Stay OS — your 14-day trial has started!`,
      html: welcomeTemplate(opts),
    });
  }

  async sendPasswordReset(opts: { to: string; name: string; resetLink: string; expiresIn: string }) {
    return this.send({
      to: opts.to,
      subject: `Reset your Dine&Stay OS password`,
      html: passwordResetTemplate(opts),
    });
  }

  async sendShiftSummary(opts: {
    to: string | string[];
    branchName: string;
    shiftNumber: string;
    openedBy: string;
    closedBy: string;
    openedAt: Date;
    closedAt: Date;
    totalSales: number;
    totalOrders: number;
    cashSales: number;
    cardSales: number;
    upiSales: number;
    openingCash: number;
    closingCash: number;
    expectedCash: number;
    cashDifference: number;
  }) {
    return this.send({
      to: opts.to,
      subject: `Shift Summary — ${opts.branchName} | ${opts.shiftNumber}`,
      html: shiftSummaryTemplate(opts),
    });
  }

  async sendBillEmail(opts: {
    to: string;
    customerName: string;
    billNumber: string;
    grandTotal: number;
    branchName: string;
    items: Array<{ name: string; qty: number; rate: number; total: number }>;
    payments: Array<{ method: string; amount: number }>;
    cgst: number;
    sgst: number;
    igst: number;
    issuedAt: Date;
  }) {
    return this.send({
      to: opts.to,
      subject: `Your bill from ${opts.branchName} — ${opts.billNumber}`,
      html: billTemplate(opts),
    });
  }

  async sendTrialExpiry(opts: { to: string; businessName: string; trialEndsAt: Date; upgradeLink: string }) {
    return this.send({
      to: opts.to,
      subject: `Your Dine&Stay OS trial expires in 3 days`,
      html: trialExpiryTemplate(opts),
    });
  }
}
