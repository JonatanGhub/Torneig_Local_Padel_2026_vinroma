import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Client de Supabase per a pàgines 100% públiques (sense sessió, sense dades
 * personalitzades) que es poden cachejar amb ISR. A diferència de
 * `@/lib/supabase/server`, NO crida `cookies()` — Next.js només marca una
 * ruta com a dinàmica (i ignora `export const revalidate`) quan detecta l'ús
 * d'una API dinàmica com `cookies()`; aquest client l'evita.
 *
 * Fa servir la clau anon: mateixos permisos de RLS que un visitant sense
 * sessió, que és exactament qui veu aquestes pàgines.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
