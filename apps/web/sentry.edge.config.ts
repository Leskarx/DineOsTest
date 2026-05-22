/**
 * Sentry edge-runtime configuration (middleware, edge API routes).
 * Auto-loaded by @sentry/nextjs for the edge bundle.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  release: process.env.SENTRY_RELEASE,
});
