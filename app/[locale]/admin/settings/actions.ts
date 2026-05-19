'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SettingsUpdateSchema = z.object({
  id: z.string().uuid(),
  legal_name: z.string().min(1),
  cif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email(),
  bizum_phone: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  contact_person_name: z.string().optional().nullable(),
  contact_person_phone: z.string().optional().nullable(),
});

export async function updateClubSettings(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = SettingsUpdateSchema.safeParse({
    id: raw.id,
    legal_name: raw.legal_name,
    cif: raw.cif || null,
    address: raw.address || null,
    email: raw.email,
    bizum_phone: raw.bizum_phone || null,
    iban: raw.iban || null,
    contact_person_name: raw.contact_person_name || null,
    contact_person_phone: raw.contact_person_phone || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'validation' } as const;
  }

  const supabase = await createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from('club_settings').update(rest).eq('id', id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/settings', 'page');
  return { ok: true } as const;
}

const CategoryMaxPairsSchema = z.object({
  categoryId: z.string().uuid(),
  maxPairs: z.coerce.number().int().min(1),
});

export async function updateCategoryMaxPairs(
  categoryId: string,
  maxPairs: number,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = CategoryMaxPairsSchema.safeParse({ categoryId, maxPairs });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false, error: 'forbidden' };

  const { error } = await supabase
    .from('categories')
    .update({ max_pairs: parsed.data.maxPairs })
    .eq('id', parsed.data.categoryId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/admin/settings', 'page');
  return { ok: true };
}

const TournamentDatesSchema = z
  .object({
    tournamentId: z.string().uuid(),
    registration_opens_at: z.string().min(1),
    registration_closes_at: z.string().min(1),
    draw_at: z.string().min(1),
    first_match_at: z.string().min(1),
    final_at: z.string().min(1),
    is_published: z.coerce.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const opens = new Date(val.registration_opens_at);
    const closes = new Date(val.registration_closes_at);
    const draw = new Date(val.draw_at);
    const first = new Date(val.first_match_at);
    const final = new Date(val.final_at);
    if (Number.isNaN(opens.getTime()))
      ctx.addIssue({ code: 'custom', path: ['registration_opens_at'], message: 'invalid_date' });
    if (Number.isNaN(closes.getTime()))
      ctx.addIssue({ code: 'custom', path: ['registration_closes_at'], message: 'invalid_date' });
    if (Number.isNaN(draw.getTime()))
      ctx.addIssue({ code: 'custom', path: ['draw_at'], message: 'invalid_date' });
    if (Number.isNaN(first.getTime()))
      ctx.addIssue({ code: 'custom', path: ['first_match_at'], message: 'invalid_date' });
    if (Number.isNaN(final.getTime()))
      ctx.addIssue({ code: 'custom', path: ['final_at'], message: 'invalid_date' });
    if (opens >= closes)
      ctx.addIssue({
        code: 'custom',
        path: ['registration_closes_at'],
        message: 'closes_before_opens',
      });
    if (closes > draw)
      ctx.addIssue({ code: 'custom', path: ['draw_at'], message: 'draw_before_closes' });
    if (draw > first)
      ctx.addIssue({ code: 'custom', path: ['first_match_at'], message: 'first_before_draw' });
    if (first > final)
      ctx.addIssue({ code: 'custom', path: ['final_at'], message: 'final_before_first' });
  });

export async function updateTournamentDates(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = TournamentDatesSchema.safeParse({
    tournamentId: raw.tournamentId,
    registration_opens_at: raw.registration_opens_at,
    registration_closes_at: raw.registration_closes_at,
    draw_at: raw.draw_at,
    first_match_at: raw.first_match_at,
    final_at: raw.final_at,
    is_published: raw.is_published === 'on' || raw.is_published === 'true',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'validation',
      field: issue?.path.join('.'),
    } as const;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' } as const;
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false, error: 'forbidden' } as const;

  const { tournamentId, is_published, ...dates } = parsed.data;
  const update = {
    registration_opens_at: new Date(dates.registration_opens_at).toISOString(),
    registration_closes_at: new Date(dates.registration_closes_at).toISOString(),
    draw_at: new Date(dates.draw_at).toISOString(),
    first_match_at: new Date(dates.first_match_at).toISOString(),
    final_at: new Date(dates.final_at).toISOString(),
    ...(typeof is_published === 'boolean' ? { is_published } : {}),
  };

  const { error } = await supabase.from('tournaments').update(update).eq('id', tournamentId);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/settings', 'page');
  revalidatePath('/', 'layout');
  return { ok: true } as const;
}
