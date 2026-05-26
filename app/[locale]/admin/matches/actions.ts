'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ScheduleSchema = z.object({
  matchId: z.string().uuid(),
  scheduledAt: z.string().min(1),
  courtLabel: z.string().min(1).max(40),
});

export type ScheduleMatchResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; conflictWith?: string };

export async function scheduleMatch(formData: FormData): Promise<ScheduleMatchResult> {
  const parsed = ScheduleSchema.safeParse({
    matchId: formData.get('matchId'),
    scheduledAt: formData.get('scheduledAt'),
    courtLabel: formData.get('courtLabel'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const isoAt = new Date(parsed.data.scheduledAt).toISOString();
  const supabase = await createClient();

  // Carrega el match per saber les parelles implicades.
  const { data: thisMatch, error: thisErr } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id')
    .eq('id', parsed.data.matchId)
    .maybeSingle();
  if (thisErr || !thisMatch) {
    return { ok: false, error: thisErr?.message ?? 'match_not_found' };
  }

  // 1) Bloqueig dur: alguna de les dues parelles ja té un partit a la mateixa
  //    hora exacta. No es pot jugar dos partits simultanis amb la mateixa parella.
  const { data: pairConflicts } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, court_label')
    .eq('scheduled_at', isoAt)
    .neq('id', parsed.data.matchId);
  const pairClash = (pairConflicts ?? []).find(
    (m) =>
      m.pair_a_id === thisMatch.pair_a_id ||
      m.pair_a_id === thisMatch.pair_b_id ||
      m.pair_b_id === thisMatch.pair_a_id ||
      m.pair_b_id === thisMatch.pair_b_id,
  );
  if (pairClash) {
    return { ok: false, error: 'pair_double_booked', conflictWith: pairClash.id };
  }

  // 2) Advertència tova: ja hi ha algun altre partit a la mateixa data/hora
  //    (parelles diferents). Es permet però es retorna warning.
  const sameSlotCount = (pairConflicts ?? []).length;

  const { error } = await supabase.rpc('schedule_match', {
    p_match_id: parsed.data.matchId,
    p_scheduled_at: isoAt,
    p_court_label: parsed.data.courtLabel,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return sameSlotCount > 0 ? { ok: true, warning: 'same_time_other_match' } : { ok: true };
}
