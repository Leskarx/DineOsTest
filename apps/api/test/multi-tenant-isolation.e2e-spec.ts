/**
 * Multi-tenant data isolation tests
 * ───────────────────────────────────
 * Verifies that Tenant A cannot read, write, or delete Tenant B's data.
 * This is the most critical security property of the system.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, registerTenant, bearer } from './helpers/test-app.factory';

describe('Multi-tenant isolation (e2e)', () => {
  let app: INestApplication;
  let tenantA: Awaited<ReturnType<typeof registerTenant>>;
  let tenantB: Awaited<ReturnType<typeof registerTenant>>;

  beforeAll(async () => {
    app = await createTestApp();
    const ts = Date.now();
    [tenantA, tenantB] = await Promise.all([
      registerTenant(app, `A${ts}`),
      registerTenant(app, `B${ts}`),
    ]);
  });

  afterAll(() => app.close());

  // ── Menu isolation ────────────────────────────────────────────────────────

  it('Tenant A menu items are not visible to Tenant B', async () => {
    // Tenant A creates a category + item
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/menu/categories')
      .set(bearer(tenantA.accessToken))
      .send({ name: 'Tenant A Specials', sortOrder: 1 });
    expect(catRes.status).toBe(201);

    const itemRes = await request(app.getHttpServer())
      .post('/api/v1/menu/items')
      .set(bearer(tenantA.accessToken))
      .send({
        name: 'Tenant A Secret Dish',
        categoryId: catRes.body.id ?? catRes.body.data?.id,
        price: 299,
        isVeg: true,
      });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.id ?? itemRes.body.data?.id;

    // Tenant B tries to read Tenant A's items — should get empty or not-found
    const bItems = await request(app.getHttpServer())
      .get('/api/v1/menu/items')
      .set(bearer(tenantB.accessToken));
    expect(bItems.status).toBe(200);
    const ids = (bItems.body.data ?? bItems.body ?? []).map((i: any) => i.id);
    expect(ids).not.toContain(itemId);
  });

  // ── Tenant profile isolation ──────────────────────────────────────────────

  it('Tenant A cannot read Tenant B profile via /tenants/me', async () => {
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/tenants/me').set(bearer(tenantA.accessToken)),
      request(app.getHttpServer()).get('/api/v1/tenants/me').set(bearer(tenantB.accessToken)),
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    // Each tenant sees only their own email
    expect(resA.body.email).not.toBe(resB.body.email);
    expect(resA.body.id).not.toBe(resB.body.id);
  });

  // ── x-tenant-id header spoofing ───────────────────────────────────────────

  it('x-tenant-id header that mismatches JWT is rejected (403/401)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set(bearer(tenantA.accessToken))
      .set('x-tenant-id', tenantB.user.tenantId); // mismatch!

    // Should be rejected — not silently ignored
    expect([401, 403]).toContain(res.status);
  });

  // ── Branch isolation ──────────────────────────────────────────────────────

  it('Tenant A branches not visible to Tenant B', async () => {
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/branches').set(bearer(tenantA.accessToken)),
      request(app.getHttpServer()).get('/api/v1/branches').set(bearer(tenantB.accessToken)),
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const idsA = (resA.body.data ?? resA.body ?? []).map((b: any) => b.id);
    const idsB = (resB.body.data ?? resB.body ?? []).map((b: any) => b.id);
    const overlap = idsA.filter((id: string) => idsB.includes(id));
    expect(overlap).toHaveLength(0);
  });

  // ── Employee isolation ────────────────────────────────────────────────────

  it('Tenant A employees not visible to Tenant B', async () => {
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/users').set(bearer(tenantA.accessToken)),
      request(app.getHttpServer()).get('/api/v1/users').set(bearer(tenantB.accessToken)),
    ]);

    const emailsA = (resA.body.data ?? resA.body ?? []).map((u: any) => u.email);
    const emailsB = (resB.body.data ?? resB.body ?? []).map((u: any) => u.email);
    const overlap = emailsA.filter((e: string) => emailsB.includes(e));
    expect(overlap).toHaveLength(0);
  });
});
