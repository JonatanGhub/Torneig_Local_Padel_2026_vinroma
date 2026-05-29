import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight health/readiness probe for uptime monitoring (Vercel,
 * UptimeRobot, load balancers). Returns 200 when the app can reach the
 * database, 503 otherwise. Never leaks secrets or row data.
 *
 *   GET /api/health  ->  { status, db, latencyMs, time, version }
 */
export async function GET() {
  const startedAt = Date.now();
  let db: 'up' | 'down' = 'down';
  let error: string | undefined;

  try {
    const supabase = createServiceClient();
    // Cheap existence check against an always-present table; head-only, no rows.
    const { error: dbError } = await supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (dbError) throw dbError;
    db = 'up';
  } catch (e) {
    error = e instanceof Error ? e.message : 'unknown error';
  }

  const ok = db === 'up';
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      db,
      ...(error ? { error } : {}),
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
