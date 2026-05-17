'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withdrawPair } from '@/lib/withdraw';

const InputSchema = z.object({
  pairId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  locale: z.enum(['ca', 'es']),
});

export type CaptainWithdrawResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | 'unauthenticated'
        | 'no_player_profile'
        | 'not_captain_of_pair'
        | 'pair_not_found'
        | 'already_withdrawn'
        | 'has_played_matches'
        | 'update_failed'
        | 'payments_update_failed';
    };

export async function captainWithdrawPair(raw: unknown): Promise<CaptainWithdrawResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { pairId, reason, locale } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!player) return { ok: false, error: 'no_player_profile' };

  const { data: pair } = await supabase
    .from('pairs')
    .select('id, captain_id')
    .eq('id', pairId)
    .maybeSingle();
  if (!pair) return { ok: false, error: 'pair_not_found' };
  if (pair.captain_id !== player.id) {
    return { ok: false, error: 'not_captain_of_pair' };
  }

  const result = await withdrawPair(supabase, pairId, {
    reason: reason ?? null,
    blockIfAnyMatchExists: true,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}/captain`);
  return { ok: true };
}
