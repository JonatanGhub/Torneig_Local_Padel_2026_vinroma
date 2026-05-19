import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActiveFee = {
  id: string;
  tournament_id: string;
  label_ca: string;
  label_es: string;
  starts_at: string;
  ends_at: string;
  amount_per_player_cents: number;
  is_default_open: boolean;
};

export type PublicFee = Omit<ActiveFee, 'tournament_id'>;

export async function getActiveFee(tournamentId: string, at: Date = new Date()) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('current_active_fee', {
    p_tournament_id: tournamentId,
    p_at: at.toISOString(),
  });

  if (error) throw error;
  return data as ActiveFee | null;
}

export async function getTournamentFees(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<PublicFee[]> {
  const { data, error } = await supabase
    .from('tournament_fees')
    .select('id, label_ca, label_es, starts_at, ends_at, amount_per_player_cents, is_default_open')
    .eq('tournament_id', tournamentId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PublicFee[];
}

export function formatCents(cents: number, locale: 'ca' | 'es' = 'ca') {
  return new Intl.NumberFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function computePerPairAmount(fee: ActiveFee) {
  return fee.amount_per_player_cents * 2;
}
