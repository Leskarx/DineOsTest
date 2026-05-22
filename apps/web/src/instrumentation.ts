/**
 * Next.js instrumentation hook.
 * @sentry/nextjs uses this to initialise server + edge monitoring.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Capture React render errors (App Router error boundaries)
export const onRequestError = async (
  err: unknown,
  request: unknown,
  context: unknown,
) => {
  const { captureRequestError } = await import('@sentry/nextjs');
  // Type cast required: Next.js types vs @sentry/nextjs types have a minor mismatch
  (captureRequestError as (e: unknown, r: unknown, c: unknown) => void)(err, request, context);
};
