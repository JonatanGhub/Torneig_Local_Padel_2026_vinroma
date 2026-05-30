import * as Sentry from '@sentry/nextjs';

// Server-side (Node.js runtime) error & performance monitoring.
// No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so local dev and preview
// builds never send events.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enabled: process.env.NODE_ENV === 'production',
  });
}
