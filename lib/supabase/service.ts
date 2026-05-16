import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Cliente Supabase con service role key — SOLO usar en código de servidor
 * (server actions, route handlers, edge functions). Saltea RLS.
 *
 * Casos de uso: enviar notificaciones que necesitan leer emails de jugadores
 * a los que el caller no tiene acceso por RLS (p.ej. rival captain).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Service client unavailable.',
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
