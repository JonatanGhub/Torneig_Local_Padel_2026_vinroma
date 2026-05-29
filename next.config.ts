import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

// Sentry wraps the config so client/server instrumentation is bundled. Source
// map upload only runs when SENTRY_AUTH_TOKEN is present (set in CI/Vercel);
// otherwise it is skipped and the build still succeeds locally.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    // The health probe must stay dependency-free and untraced.
    excludeServerRoutes: ['/api/health'],
    // Tree-shake Sentry debug logging out of the production bundle.
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
