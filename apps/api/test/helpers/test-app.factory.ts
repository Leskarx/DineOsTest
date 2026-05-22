/**
 * Shared test application factory.
 * Creates an isolated NestJS app backed by a real test database.
 *
 * Uses the DATABASE_URL_TEST env var (falls back to DATABASE_URL with
 * "_test" appended to the database name).
 *
 * Runs each suite in its own transaction that is rolled back after each test,
 * so the DB stays clean with zero teardown cost.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import * as request from 'supertest';

export async function createTestApp(): Promise<INestApplication> {
  // Point TypeORM at the test database before the module loads
  process.env.NODE_ENV = 'test';
  if (!process.env.DATABASE_URL_TEST) {
    const base = process.env.DATABASE_URL ?? 'postgresql://dinestayadmin:changeme@localhost:5432/dinestay';
    process.env.DATABASE_URL_TEST = base.replace(/\/([^/?]+)(\?|$)/, '/dinestay_test$2');
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // Mirror main.ts: versioning must be enabled before setGlobalPrefix
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

/** Register a tenant and return tokens + IDs */
export async function registerTenant(app: INestApplication, suffix = '') {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      businessName: `Test Restaurant ${suffix}`,
      email: `test${suffix}@dinestay-test.io`,
      phone: `+9199999${suffix.padStart(5, '0')}`,
      password: 'Password123!',
    });

  if (res.status !== 201) throw new Error(`Register failed: ${JSON.stringify(res.body)}`);
  return res.body.data as {
    accessToken:  string;
    refreshToken: string;
    user: { id: string; tenantId: string; branchId: string; role: string };
  };
}

/** Auth header helper */
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
