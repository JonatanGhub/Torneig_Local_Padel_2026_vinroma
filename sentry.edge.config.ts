import * as Sentry from '@sentry/nextjs';

// Edge runtime (middleware, edge route handlers) error monitoring.
// No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enabled: process.env.NODE_ENV === 'production',
  });
}
