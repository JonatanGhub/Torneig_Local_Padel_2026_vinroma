import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// The module reads env at call time (functions, not top-level constants), so we
// can mutate process.env between cases and re-import fresh via dynamic import.
const SAVE = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

async function freshModule() {
  // site-url.ts has no module-level caching, but reset modules to be safe.
  const mod = await import('@/lib/site-url');
  return mod;
}

describe('site-url', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = SAVE.site;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = SAVE.vercel;
  });

  it('prefers NEXT_PUBLIC_SITE_URL and strips a trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/';
    const { getSiteUrl } = await freshModule();
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('falls back to the Vercel production URL with protocol added', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'myapp.vercel.app';
    const { getSiteUrl } = await freshModule();
    expect(getSiteUrl()).toBe('https://myapp.vercel.app');
  });

  it('uses the known project domain as the last resort (never the broken -v- one)', async () => {
    const { getSiteUrl } = await freshModule();
    const url = getSiteUrl();
    expect(url).toBe('https://torneig-local-padel-2026-vinroma.vercel.app');
    expect(url).not.toContain('-v-2026');
  });

  it('builds absolute URLs with or without a leading slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    const { absoluteUrl } = await freshModule();
    expect(absoluteUrl('/ca/captain')).toBe('https://example.com/ca/captain');
    expect(absoluteUrl('ca/captain')).toBe('https://example.com/ca/captain');
  });

  it('returns the host without protocol for webcal feeds', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    const { getSiteHost } = await freshModule();
    expect(getSiteHost()).toBe('example.com');
  });
});
