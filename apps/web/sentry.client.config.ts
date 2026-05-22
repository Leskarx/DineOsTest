/**
 * Sentry client-side configuration.
 * This file is auto-loaded by @sentry/nextjs for browser bundles.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn,   // undefined → Sentry disabled (safe when DSN not set)
  environment: env,

  // ── Sampling ──────────────────────────────────────────────────────────────
  tracesSampleRate: env === 'production' ? 0.1 : 1.0,

  // ── Session replay (catch bugs as they happen) ─────────────────────────
  // Records 5 % of sessions and 100 % of sessions with errors.
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media to avoid leaking PII
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // ── Release ───────────────────────────────────────────────────────────────
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // ── PII scrubbing ─────────────────────────────────────────────────────────
  beforeSend(event) {
    // Strip sensitive fields from request data (passwords, tokens)
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ['password', 'newPassword', 'token', 'accessToken', 'refreshToken']) {
        if (key in data) data[key] = '[REDACTED]';
      }
    }
    return event;
  },
});
