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

export type AdminWithdrawResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | 'unauthenticated'
        | 'forbidden'
        | 'pair_not_found'
        | 'already_withdrawn'
        | 'has_played_matches'
        | 'update_failed'
        | 'payments_update_failed';
    };

export async function adminWithdrawPair(raw: unknown): Promise<AdminWithdrawResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { pairId, reason, locale } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role !== 'admin') return { ok: false, error: 'forbidden' };

  const annotatedReason = reason ? `[admin] ${reason}` : '[admin] retirada manual';

  const result = await withdrawPair(supabase, pairId, {
    reason: annotatedReason,
    blockIfAnyMatchExists: false,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}/admin/registrations`);
  revalidatePath(`/${locale}/admin`);
  return { ok: true };
}
