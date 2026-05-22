import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken) private readonly prtRepo: Repository<PasswordResetToken>,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  // ─── Trial Expiry Checker — runs every day at 9 AM ────────────────────────
  // Sends warning email when trial has 3 days left, locks account when expired

  @Cron('0 9 * * *', { name: 'trial-expiry-check', timeZone: 'Asia/Kolkata' })
  async checkTrialExpiry() {
    this.logger.log('Running trial expiry check...');
    const now = new Date();

    // 1. Warn tenants whose trial ends in exactly 3 days
    const warnFrom = new Date(now);
    warnFrom.setDate(warnFrom.getDate() + 3);
    warnFrom.setHours(0, 0, 0, 0);

    const warnTo = new Date(warnFrom);
    warnTo.setHours(23, 59, 59, 999);

    const expiringSoon = await this.subRepo.find({
      where: { status: SubscriptionStatus.TRIAL, trialEndsAt: Between(warnFrom, warnTo) },
      relations: ['plan'],
    });

    for (const sub of expiringSoon) {
      const tenant = await this.tenantRepo.findOne({ where: { id: sub.tenantId } });
      if (!tenant) continue;

      const appUrl = this.config.get('APP_URL', 'http://localhost:3001');
      await this.mailer.sendTrialExpiry({
        to: tenant.email,
        businessName: tenant.name,
        trialEndsAt: sub.trialEndsAt,
        upgradeLink: `${appUrl}/settings/billing`,
      }).catch(() => {});

      this.logger.log(`Trial expiry warning sent to ${tenant.email}`);
    }

    // 2. Mark expired trials as cancelled
    const expired = await this.subRepo.find({
      where: { status: SubscriptionStatus.TRIAL, trialEndsAt: LessThan(now) },
    });

    for (const sub of expired) {
      sub.status = SubscriptionStatus.CANCELLED;
      sub.cancelReason = 'Trial period expired';
      sub.cancelledAt = now;
      await this.subRepo.save(sub);
      this.logger.warn(`Trial expired for tenant ${sub.tenantId} — account locked`);
    }

    this.logger.log(`Trial check done. Warned: ${expiringSoon.length}, Expired: ${expired.length}`);
  }

  // ─── Subscription Renewal Warning — runs every day at 10 AM ──────────────
  // Warns active subscribers 7 days before their period ends

  @Cron('0 10 * * *', { name: 'subscription-renewal-warning', timeZone: 'Asia/Kolkata' })
  async checkSubscriptionRenewals() {
    this.logger.log('Running subscription renewal check...');
    const now = new Date();

    const warnFrom = new Date(now);
    warnFrom.setDate(warnFrom.getDate() + 7);
    warnFrom.setHours(0, 0, 0, 0);

    const warnTo = new Date(warnFrom);
    warnTo.setHours(23, 59, 59, 999);

    const renewingSoon = await this.subRepo.find({
      where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: Between(warnFrom, warnTo) },
      relations: ['plan'],
    });

    for (const sub of renewingSoon) {
      const tenant = await this.tenantRepo.findOne({ where: { id: sub.tenantId } });
      if (!tenant) continue;

      const appUrl = this.config.get('APP_URL', 'http://localhost:3001');
      // Reuse trial expiry template with different message context
      await this.mailer.send({
        to: tenant.email,
        subject: `Your Dine&Stay OS subscription renews in 7 days`,
        html: `<p>Hi,<br/>Your <strong>${sub.plan?.name}</strong> plan renews on
          <strong>${sub.currentPeriodEnd?.toLocaleDateString('en-IN')}</strong>.<br/>
          Manage your subscription at <a href="${appUrl}/settings/billing">${appUrl}/settings/billing</a></p>`,
      }).catch(() => {});

      this.logger.log(`Renewal warning sent to ${tenant.email}`);
    }
  }

  // ─── Daily Shift Summary — runs every night at 11:59 PM ──────────────────
  // Emails shift summary to branch manager for any shifts still open

  @Cron('59 23 * * *', { name: 'daily-shift-summary', timeZone: 'Asia/Kolkata' })
  async sendDailyShiftSummary() {
    this.logger.log('Running daily shift summary...');

    const openShifts = await this.shiftRepo.find({
      where: { status: ShiftStatus.OPEN },
    });

    for (const shift of openShifts) {
      this.logger.warn(
        `Shift ${shift.shiftNumber} (branch ${shift.branchId}) still open at end of day!`,
      );
      // Find branch manager/owner to notify
      const manager = await this.userRepo.findOne({
        where: { branchId: shift.branchId, isActive: true, role: 'manager' as any },
      });
      const owner = await this.userRepo.findOne({
        where: { tenantId: shift.tenantId, isActive: true, role: 'owner' as any },
      });

      const notifyEmail = manager?.email || owner?.email;
      if (notifyEmail) {
        await this.mailer.send({
          to: notifyEmail,
          subject: `⚠️ Shift ${shift.shiftNumber} is still open — please close it`,
          html: `<p>Shift <strong>${shift.shiftNumber}</strong> opened on
            <strong>${shift.createdAt.toLocaleDateString('en-IN')}</strong>
            is still open. Please close the shift to finalise your daily reconciliation.</p>`,
        }).catch(() => {});
      }
    }

    this.logger.log(`Shift summary done. Open shifts found: ${openShifts.length}`);
  }

  // ─── Clean up expired password reset tokens — runs every hour ─────────────

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-expired-tokens' })
  async cleanupExpiredTokens() {
    const result = await this.prtRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired password reset tokens`);
    }
  }

  // ─── Mark past_due subscriptions — runs every day at midnight ────────────

  @Cron('0 0 * * *', { name: 'subscription-past-due-check', timeZone: 'Asia/Kolkata' })
  async checkPastDueSubscriptions() {
    const now = new Date();
    const pastDue = await this.subRepo.find({
      where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: LessThan(now) },
    });

    for (const sub of pastDue) {
      sub.status = SubscriptionStatus.PAST_DUE;
      await this.subRepo.save(sub);
      this.logger.warn(`Subscription for tenant ${sub.tenantId} is past due`);
    }
  }
}
