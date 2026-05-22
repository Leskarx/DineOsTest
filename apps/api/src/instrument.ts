/**
 * Sentry instrumentation — MUST be imported at the very top of main.ts,
 * before any NestJS / TypeORM imports.
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nestjs/
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn,   // undefined → Sentry is a no-op (safe for local dev with no DSN set)
  environment: env,

  // ── Integrations ──────────────────────────────────────────────────────────
  integrations: [
    nodeProfilingIntegration(),
  ],

  // ── Sampling ──────────────────────────────────────────────────────────────
  // Capture 100 % of transactions in non-prod, 10 % in production.
  // Adjust once you know your traffic volume.
  tracesSampleRate: env === 'production' ? 0.1 : 1.0,
  profilesSampleRate: env === 'production' ? 0.1 : 1.0,

  // ── Release tagging ───────────────────────────────────────────────────────
  // Set SENTRY_RELEASE in CI (e.g. git SHA) for release tracking.
  release: process.env.SENTRY_RELEASE,

  // ── PII scrubbing ─────────────────────────────────────────────────────────
  // Strip passwords, tokens, and card numbers before sending to Sentry.
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ['password', 'newPassword', 'passwordHash', 'token', 'cardNumber', 'cvv']) {
        if (key in data) data[key] = '[REDACTED]';
      }
    }
    return event;
  },
});
