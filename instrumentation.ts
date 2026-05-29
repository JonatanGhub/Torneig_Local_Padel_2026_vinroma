import * as Sentry from '@sentry/nextjs';

// Next.js instrumentation hook — loads the correct Sentry config per runtime.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown in nested React Server Components.
export const onRequestError = Sentry.captureRequestError;
