import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type WithdrawPairResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'pair_not_found'
        | 'already_withdrawn'
        | 'has_played_matches'
        | 'update_failed'
        | 'payments_update_failed';
    };

const PLAYED_MATCH_STATUSES = ['validated', 'pending_validation', 'walkover', 'disputed'] as const;

export type WithdrawOptions = {
  reason: string | null;
  blockIfAnyMatchExists?: boolean;
};

export async function withdrawPair(
  supabase: SupabaseClient<Database>,
  pairId: string,
  options: WithdrawOptions,
): Promise<WithdrawPairResult> {
  const { data: pair, error: pairErr } = await supabase
    .from('pairs')
    .select('id, status')
    .eq('id', pairId)
    .maybeSingle();

  if (pairErr || !pair) {
    return { ok: false, error: 'pair_not_found' };
  }
  if (pair.status === 'withdrawn' || pair.status === 'disqualified') {
    return { ok: false, error: 'already_withdrawn' };
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('id, status')
    .or(`pair_a_id.eq.${pairId},pair_b_id.eq.${pairId}`);

  const playedMatch = (matches ?? []).find((m) =>
    (PLAYED_MATCH_STATUSES as readonly string[]).includes(m.status),
  );
  if (playedMatch) {
    return { ok: false, error: 'has_played_matches' };
  }
  if (options.blockIfAnyMatchExists && (matches ?? []).length > 0) {
    return { ok: false, error: 'has_played_matches' };
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('pairs')
    .update({
      status: 'withdrawn',
      withdrawn_at: now,
      withdrawal_reason: options.reason,
    })
    .eq('id', pairId);

  if (updateErr) {
    return { ok: false, error: 'update_failed' };
  }

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'cancelled', notes: `[withdraw] ${options.reason ?? ''}` })
    .eq('pair_id', pairId)
    .eq('status', 'pending');

  if (payErr) {
    return { ok: false, error: 'payments_update_failed' };
  }

  return { ok: true };
}
