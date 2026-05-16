'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const EntrySchema = z.object({
  pairId: z.string().uuid(),
  kind: z.enum(['income', 'expense']),
  amount: z
    .string()
    .refine((v) => /^\d+([.,]\d{1,2})?$/.test(v.trim()), { message: 'invalid_amount' }),
  label: z.string().min(1).max(120),
  occurredOn: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid_date' }),
  notes: z.string().max(500).nullable().optional(),
});

function eurosToCents(input: string): number {
  const normalized = input.trim().replace(',', '.');
  const value = Math.round(Number(normalized) * 100);
  return Number.isFinite(value) ? value : 0;
}

async function getCaptainPlayerId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: 'unauthenticated' as const };
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!player) return { supabase, error: 'no_player_profile' as const };
  return { supabase, playerId: player.id };
}

export async function addFinanceEntry(formData: FormData) {
  const parsed = EntrySchema.safeParse({
    pairId: formData.get('pairId'),
    kind: formData.get('kind'),
    amount: formData.get('amount'),
    label: formData.get('label'),
    occurredOn: formData.get('occurredOn'),
    notes: (formData.get('notes') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const auth = await getCaptainPlayerId();
  if (auth.error) return { ok: false, error: auth.error } as const;

  // RLS verificará que el player sea captain de pair_id.
  const { error } = await auth.supabase.from('pair_finance_entries').insert({
    pair_id: parsed.data.pairId,
    kind: parsed.data.kind,
    amount_cents: eurosToCents(parsed.data.amount),
    label: parsed.data.label,
    occurred_on: parsed.data.occurredOn,
    notes: parsed.data.notes ?? null,
    created_by_player_id: auth.playerId,
  });
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/captain/finance', 'page');
  return { ok: true } as const;
}

export async function deleteFinanceEntry(formData: FormData) {
  const id = formData.get('entryId');
  if (typeof id !== 'string') return { ok: false, error: 'invalid_input' } as const;

  const auth = await getCaptainPlayerId();
  if (auth.error) return { ok: false, error: auth.error } as const;

  const { error } = await auth.supabase.from('pair_finance_entries').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/captain/finance', 'page');
  return { ok: true } as const;
}
