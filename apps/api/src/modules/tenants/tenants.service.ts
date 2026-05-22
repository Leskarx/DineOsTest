import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private readonly repo: Repository<Tenant>) {}

  findById(id: string)     { return this.repo.findOne({ where: { id } }); }
  findBySlug(slug: string) { return this.repo.findOne({ where: { slug } }); }

  async update(id: string, data: Partial<Tenant>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  // ── Razorpay integration ────────────────────────────────────────────────────

  async getRazorpayStatus(tenantId: string) {
    const tenant = await this.findById(tenantId);
    const rzp = tenant?.settings?.razorpay ?? {};
    return {
      connected:   !!rzp.connected,
      liveMode:    !!rzp.liveMode,
      keyId:       rzp.keyId ?? null,
      connectedAt: rzp.connectedAt ?? null,
    };
  }

  async saveRazorpayKeys(
    tenantId: string,
    keyId: string,
    keySecret: string,
  ) {
    // Verify keys against Razorpay API before saving
    const valid = await this.verifyRazorpayKeys(keyId, keySecret);
    if (!valid) {
      throw new BadRequestException(
        'Invalid Razorpay credentials. Please check your Key ID and Secret and try again.',
      );
    }

    const tenant = await this.findById(tenantId);
    const existingSettings = tenant?.settings ?? {};

    const liveMode = keyId.startsWith('rzp_live_');

    const updated = await this.repo.save({
      ...tenant,
      settings: {
        ...existingSettings,
        razorpay: {
          keyId,
          keySecret,     // ⚠️  Encrypt this at-rest in production via KMS / Vault
          connected:    true,
          liveMode,
          connectedAt:  new Date().toISOString(),
        },
      },
    });

    return {
      connected:   true,
      liveMode,
      keyId,
      connectedAt: updated.settings.razorpay.connectedAt,
    };
  }

  async disconnectRazorpay(tenantId: string) {
    const tenant = await this.findById(tenantId);
    const existingSettings = tenant?.settings ?? {};
    await this.repo.save({
      ...tenant,
      settings: {
        ...existingSettings,
        razorpay: { connected: false, keyId: null, keySecret: null, liveMode: false },
      },
    });
    return { connected: false };
  }

  /** Makes a lightweight Razorpay REST call to validate credentials */
  private verifyRazorpayKeys(keyId: string, keySecret: string): Promise<boolean> {
    return new Promise((resolve) => {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const req = https.request(
        {
          hostname: 'api.razorpay.com',
          path:     '/v1/payments?count=1',
          method:   'GET',
          headers:  { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        },
        (res) => {
          // 200 = valid, 401 = bad creds, 400 = valid creds (bad params is OK here)
          resolve(res.statusCode !== 401 && res.statusCode !== 403);
        },
      );
      req.on('error', () => resolve(false));
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.end();
    });
  }
}
