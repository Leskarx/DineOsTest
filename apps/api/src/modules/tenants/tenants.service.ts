import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import { Tenant } from './entities/tenant.entity';

// Only these Tenant entity properties are allowed to be updated via PUT /tenant
const ALLOWED_UPDATE_FIELDS: (keyof Tenant)[] = [
  'name',
  'gstin',
  'pan',
  'fssaiNo',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'stateCode',
  'pincode',
  'country',
  'email',
  'phone',
  'logoUrl',
  'taxRegime',
  'settings',
];

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
  ) {}

  findById(id: string)     { return this.repo.findOne({ where: { id } }); }
  findBySlug(slug: string) { return this.repo.findOne({ where: { slug } }); }

  async update(id: string, data: Partial<Tenant>) {
    // Strip any fields that are not mapped columns on the Tenant entity.
    // This prevents EntityPropertyNotFoundError when the frontend sends
    // extra UI-only fields like notifLowStock, notifEmail, etc.
    const safe: Partial<Tenant> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in data) {
        (safe as any)[key] = (data as any)[key];
      }
    }

    if (Object.keys(safe).length === 0) {
      // Nothing valid to update — just return current state
      return this.findById(id);
    }

    await this.repo.update(id, safe);
    return this.findById(id);
  }

  // ── Razorpay integration ────────────────────────────────────────────────────

  async getRazorpayStatus(tenantId: string) {
    const tenant = await this.findById(tenantId);
    const rzp = tenant?.settings?.razorpay ?? {};
    return {
      connected:   !!rzp.connected,
      liveMode:    !!rzp.liveMode,
      keyId:       rzp.keyId   ?? null,
      connectedAt: rzp.connectedAt ?? null,
    };
  }

  async saveRazorpayKeys(tenantId: string, keyId: string, keySecret: string) {
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
          keySecret,      // ⚠️ Encrypt at-rest in production via KMS / Vault
          connected:   true,
          liveMode,
          connectedAt: new Date().toISOString(),
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
          resolve(res.statusCode !== 401 && res.statusCode !== 403);
        },
      );
      req.on('error', () => resolve(false));
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.end();
    });
  }
}