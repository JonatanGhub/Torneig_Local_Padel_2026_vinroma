'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SubscribeSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(['ca', 'es']),
  source: z.string().max(64).optional().nullable(),
});

export async function subscribeInterest(formData: FormData) {
  const parsed = SubscribeSchema.safeParse({
    email: formData.get('email'),
    locale: formData.get('locale'),
    source: formData.get('source') || null,
  });
  if (!parsed.success) {
    return { ok: false, error: 'invalid_email' } as const;
  }

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return { ok: false, error: 'unknown_tournament' } as const;

  const { error } = await supabase.from('interest_subscriptions').insert({
    tournament_id: tournament.id,
    email: parsed.data.email.toLowerCase().trim(),
    locale: parsed.data.locale,
    source: parsed.data.source ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: true, alreadySubscribed: true } as const;
    }
    return { ok: false, error: error.message } as const;
  }

  return { ok: true, alreadySubscribed: false } as const;
}
