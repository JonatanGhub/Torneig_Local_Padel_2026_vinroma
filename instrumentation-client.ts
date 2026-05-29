import * as Sentry from '@sentry/nextjs';

// Browser error monitoring. No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: Number(process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 0),
    enabled: process.env.NODE_ENV === 'production',
  });
}

// Instruments client-side router navigations for performance tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
