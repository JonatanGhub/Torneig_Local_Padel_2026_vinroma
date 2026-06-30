'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { notifyMatchValidatedWhatsApp, notifyValidatedToGroup } from '@/lib/whatsapp/notify';

const WalkoverSchema = z.object({
  matchId: z.string().uuid(),
  winnerPairId: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});

export async function adminAcceptReport(formData: FormData) {
  const matchId = formData.get('matchId');
  const side = formData.get('side');
  if (typeof matchId !== 'string' || (side !== 'a' && side !== 'b')) {
    return { ok: false, error: 'invalid_input' } as const;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_accept_report', {
    p_match_id: matchId,
    p_side: side,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Notificació als capitans i al grup (igual que quan es valida normalment)
  await notifyMatchValidatedWhatsApp(matchId);
  await notifyValidatedToGroup(matchId);

  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}

export async function setWalkover(formData: FormData) {
  const parsed = WalkoverSchema.safeParse({
    matchId: formData.get('matchId'),
    winnerPairId: formData.get('winnerPairId'),
    reason: (formData.get('reason') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_walkover', {
    p_match_id: parsed.data.matchId,
    p_winner_pair_id: parsed.data.winnerPairId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}
