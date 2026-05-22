/**
 * Subscription guard tests
 * ─────────────────────────
 * Verifies that suspended/cancelled tenants receive 402 on protected routes,
 * and that active/trial tenants pass through freely.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, bearer } from './helpers/test-app.factory';

describe('Subscription guard (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let tenant: Awaited<ReturnType<typeof registerTenant>>;

  beforeAll(async () => {
    app  = await createTestApp();
    db   = app.get(DataSource);
    tenant = await registerTenant(app, `sub-${Date.now()}`);
  });

  afterAll(() => app.close());

  it('Active/trial tenant can access protected endpoints (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/menu/items')
      .set(bearer(tenant.accessToken));

    expect([200, 204]).toContain(res.status);
  });

  it('Suspended tenant receives 402 on protected endpoints', async () => {
    // Suspend the tenant directly in DB
    await db.query(
      `UPDATE tenants SET is_active = false WHERE id = $1`,
      [tenant.user.tenantId],
    );

    const res = await request(app.getHttpServer())
      .get('/api/v1/menu/items')
      .set(bearer(tenant.accessToken));

    expect(res.status).toBe(402);

    // Restore
    await db.query(
      `UPDATE tenants SET is_active = true WHERE id = $1`,
      [tenant.user.tenantId],
    );
  });

  it('Cancelled subscription tenant receives 402', async () => {
    await db.query(
      `UPDATE subscriptions SET status = 'cancelled' WHERE tenant_id = $1`,
      [tenant.user.tenantId],
    );

    const res = await request(app.getHttpServer())
      .get('/api/v1/menu/items')
      .set(bearer(tenant.accessToken));

    expect(res.status).toBe(402);

    // Restore
    await db.query(
      `UPDATE subscriptions SET status = 'trial' WHERE tenant_id = $1`,
      [tenant.user.tenantId],
    );
  });
});
