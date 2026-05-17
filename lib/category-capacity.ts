import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const ACTIVE_PAIR_STATUSES = ['pending_payment', 'confirmed'] as const;

export type CategoryCapacity = { used: number; max: number; full: boolean };

export async function getCategoryCounts(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('pairs')
    .select('category_id')
    .eq('tournament_id', tournamentId)
    .in('status', [...ACTIVE_PAIR_STATUSES]);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

export async function isCategoryFull(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
  categoryId: string,
  maxPairs: number,
): Promise<boolean> {
  const { count } = await supabase
    .from('pairs')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
    .in('status', [...ACTIVE_PAIR_STATUSES]);

  return (count ?? 0) >= maxPairs;
}
