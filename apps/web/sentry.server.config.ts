/**
 * Sentry server-side configuration (Node.js runtime — RSC, API routes).
 * Auto-loaded by @sentry/nextjs for the server bundle.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn,
  environment: env,
  tracesSampleRate: env === 'production' ? 0.1 : 1.0,
  release: process.env.SENTRY_RELEASE,

  // Don't log Sentry's own debug output in production
  debug: env === 'development',

  beforeSend(event) {
    // Strip sensitive fields from server-side request bodies
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ['password', 'newPassword', 'token', 'accessToken', 'refreshToken']) {
        if (key in data) data[key] = '[REDACTED]';
      }
    }
    return event;
  },
});
