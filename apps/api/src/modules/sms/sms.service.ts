import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Redis from 'ioredis';

const OTP_TTL_SECONDS  = 10 * 60;   // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_KEY          = (phone: string) => `otp:${phone}`;
const OTP_ATTEMPTS_KEY = (phone: string) => `otp:attempts:${phone}`;

@Injectable()
export class SmsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsService.name);
  private readonly authKey: string;
  private readonly senderId: string;
  private readonly enabled: boolean;
  private redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.authKey = config.get('MSG91_AUTH_KEY', '');
    this.senderId = config.get('MSG91_SENDER_ID', 'DNSTAY');
    this.enabled = !!(this.authKey && this.authKey !== 'xxxxx');

    if (!this.enabled) {
      this.logger.warn('MSG91 not configured — OTPs will be logged only');
    }
  }

  onModuleInit() {
    this.redis = new Redis({
      host:     this.config.get('REDIS_HOST', 'localhost'),
      port:     this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD', '') || undefined,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    this.redis.on('error', (err) =>
      this.logger.warn(`Redis OTP store error: ${err.message}`),
    );
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  // ─── Generate and send OTP ───────────────────────────────────────────────

  async sendOtp(phone: string): Promise<{ sent: boolean; message: string }> {
    const normalised = this.normalisePhone(phone);

    const otp  = crypto.randomInt(100000, 999999).toString();
    const hash = crypto.createHash('sha256').update(`${normalised}:${otp}`).digest('hex');

    // Store hash in Redis with TTL — atomic set
    await this.redis.set(OTP_KEY(normalised), hash, 'EX', OTP_TTL_SECONDS);
    await this.redis.del(OTP_ATTEMPTS_KEY(normalised));   // reset attempt counter

    if (!this.enabled) {
      this.logger.log(`[SMS DEV] OTP for ${normalised}: ${otp}`);
      return { sent: true, message: 'OTP sent (dev mode — check server logs)' };
    }

    try {
      const res = await fetch('https://api.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: this.authKey },
        body: JSON.stringify({
          template_id: this.config.get('MSG91_OTP_TEMPLATE_ID', ''),
          mobile: `91${normalised}`,
          authkey: this.authKey,
          otp,
        }),
      });

      const data = await res.json() as any;
      if (data.type === 'success') {
        this.logger.log(`OTP sent to ${normalised}`);
        return { sent: true, message: 'OTP sent successfully' };
      }
      this.logger.error(`MSG91 error for ${normalised}: ${JSON.stringify(data)}`);
      return { sent: false, message: 'Failed to send OTP' };
    } catch (err) {
      this.logger.error(`SMS send failed for ${normalised}`, err);
      return { sent: false, message: 'SMS service unavailable' };
    }
  }

  // ─── Verify OTP ──────────────────────────────────────────────────────────

  async verifyOtp(phone: string, otp: string): Promise<{ valid: boolean; reason?: string }> {
    const normalised = this.normalisePhone(phone);

    const [storedHash, attemptsRaw] = await Promise.all([
      this.redis.get(OTP_KEY(normalised)),
      this.redis.get(OTP_ATTEMPTS_KEY(normalised)),
    ]);

    if (!storedHash) {
      return { valid: false, reason: 'No OTP found — request a new one' };
    }

    const attempts = parseInt(attemptsRaw || '0', 10);
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await this.redis.del(OTP_KEY(normalised), OTP_ATTEMPTS_KEY(normalised));
      return { valid: false, reason: 'Too many attempts — request a new OTP' };
    }

    // Increment attempt counter (TTL matches OTP key)
    await this.redis.set(OTP_ATTEMPTS_KEY(normalised), attempts + 1, 'EX', OTP_TTL_SECONDS);

    const expectedHash = crypto
      .createHash('sha256')
      .update(`${normalised}:${otp}`)
      .digest('hex');

    if (storedHash !== expectedHash) {
      const left = MAX_OTP_ATTEMPTS - attempts - 1;
      return { valid: false, reason: `Incorrect OTP (${left} attempt${left === 1 ? '' : 's'} left)` };
    }

    // Valid — delete from Redis immediately (single-use)
    await this.redis.del(OTP_KEY(normalised), OTP_ATTEMPTS_KEY(normalised));
    return { valid: true };
  }

  // ─── Plain text SMS ───────────────────────────────────────────────────────

  async sendSms(phone: string, message: string): Promise<boolean> {
    const normalised = this.normalisePhone(phone);

    if (!this.enabled) {
      this.logger.log(`[SMS DEV] To: ${normalised} | ${message}`);
      return true;
    }

    try {
      const res = await fetch('https://api.msg91.com/api/v2/sendsms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: this.authKey },
        body: JSON.stringify({
          sender: this.senderId,
          route: '4',
          country: '91',
          sms: [{ message, to: [`91${normalised}`] }],
        }),
      });
      const data = await res.json() as any;
      return data.type === 'success';
    } catch (err) {
      this.logger.error(`SMS send failed for ${normalised}`, err);
      return false;
    }
  }

  private normalisePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^91/, '').slice(-10);
  }
}
