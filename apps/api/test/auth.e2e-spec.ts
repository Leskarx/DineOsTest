/**
 * Auth flow integration tests
 * ─────────────────────────────
 * Covers: register → login → access protected endpoint → refresh → session list
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, bearer } from './helpers/test-app.factory';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const EMAIL    = `auth-test-${Date.now()}@dinestay-test.io`;
  const PASSWORD = 'Password123!';
  let accessToken:  string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  it('POST /auth/register — creates tenant + user + trial subscription', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ businessName: 'Auth Test Restaurant', email: EMAIL, phone: '+919000000001', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      accessToken:  expect.any(String),
      refreshToken: expect.any(String),
      user: expect.objectContaining({ email: EMAIL, role: 'owner' }),
    });

    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /auth/register — rejects duplicate email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ businessName: 'Dup', email: EMAIL, phone: '+919000000002', password: PASSWORD });

    expect(res.status).toBe(409);
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  it('POST /auth/login — returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /auth/login — rejects wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'wrong' });

    expect(res.status).toBe(401);
  });

  // ── Protected endpoint ────────────────────────────────────────────────────

  it('GET /tenants/me — returns tenant profile with valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: EMAIL });
  });

  it('GET /tenants/me — rejects missing token (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tenants/me');
    expect(res.status).toBe(401);
  });

  it('GET /tenants/me — rejects malformed token (401)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });

  // ── Token refresh ─────────────────────────────────────────────────────────

  it('POST /auth/refresh — returns new access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    accessToken = res.body.data.accessToken;
  });

  it('POST /auth/refresh — rejects invalid refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'fake.refresh.token' });

    expect(res.status).toBe(401);
  });

  // ── Password reset ────────────────────────────────────────────────────────

  it('POST /auth/forgot-password — always returns 200 (no email enumeration)', async () => {
    const [real, fake] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({ email: EMAIL }),
      request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.io' }),
    ]);
    expect(real.status).toBe(200);
    expect(fake.status).toBe(200);
    expect(real.body.message).toBe(fake.body.message);
  });
});
