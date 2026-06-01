'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { madridInputToISO } from '@/lib/format-date';

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
  // Els valors venen de <input datetime-local> (hora de paret de Madrid). Es
  // converteixen a instant UTC tenint en compte el fus.
  const update = {
    registration_opens_at: madridInputToISO(dates.registration_opens_at),
    registration_closes_at: madridInputToISO(dates.registration_closes_at),
    draw_at: madridInputToISO(dates.draw_at),
    first_match_at: madridInputToISO(dates.first_match_at),
    final_at: madridInputToISO(dates.final_at),
    ...(typeof is_published === 'boolean' ? { is_published } : {}),
  };

  const { error } = await supabase.from('tournaments').update(update).eq('id', tournamentId);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/settings', 'page');
  revalidatePath('/', 'layout');
  return { ok: true } as const;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthenticated' as const };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false as const, error: 'forbidden' as const };
  return { ok: true as const, supabase };
}

const FeeInputSchema = z
  .object({
    tournamentId: z.string().uuid(),
    label_ca: z.string().min(1).max(120),
    label_es: z.string().min(1).max(120),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    amount_eur: z.coerce.number().nonnegative(),
    is_default_open: z.coerce.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const starts = new Date(val.starts_at);
    const ends = new Date(val.ends_at);
    if (Number.isNaN(starts.getTime()))
      ctx.addIssue({ code: 'custom', path: ['starts_at'], message: 'invalid_date' });
    if (Number.isNaN(ends.getTime()))
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'invalid_date' });
    if (starts >= ends)
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'ends_before_starts' });
  });

export async function createFee(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = FeeInputSchema.safeParse({
    tournamentId: raw.tournamentId,
    label_ca: raw.label_ca,
    label_es: raw.label_es,
    starts_at: raw.starts_at,
    ends_at: raw.ends_at,
    amount_eur: raw.amount_eur,
    is_default_open: raw.is_default_open === 'on' || raw.is_default_open === 'true',
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? 'validation' } as const;
  }
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { tournamentId, amount_eur, ...rest } = parsed.data;
  const { error } = await auth.supabase.from('tournament_fees').insert({
    tournament_id: tournamentId,
    label_ca: rest.label_ca,
    label_es: rest.label_es,
    starts_at: madridInputToISO(rest.starts_at),
    ends_at: madridInputToISO(rest.ends_at),
    amount_per_player_cents: Math.round(amount_eur * 100),
    is_default_open: rest.is_default_open ?? false,
  });
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/settings', 'page');
  return { ok: true } as const;
}

const FeeUpdateSchema = FeeInputSchema.innerType().extend({ id: z.string().uuid() });

export async function updateFee(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = FeeUpdateSchema.safeParse({
    id: raw.id,
    tournamentId: raw.tournamentId,
    label_ca: raw.label_ca,
    label_es: raw.label_es,
    starts_at: raw.starts_at,
    ends_at: raw.ends_at,
    amount_eur: raw.amount_eur,
    is_default_open: raw.is_default_open === 'on' || raw.is_default_open === 'true',
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? 'validation' } as const;
  }
  const startsISO = madridInputToISO(parsed.data.starts_at);
  const endsISO = madridInputToISO(parsed.data.ends_at);
  if (new Date(startsISO) >= new Date(endsISO))
    return { ok: false, error: 'ends_before_starts' } as const;

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from('tournament_fees')
    .update({
      label_ca: parsed.data.label_ca,
      label_es: parsed.data.label_es,
      starts_at: startsISO,
      ends_at: endsISO,
      amount_per_player_cents: Math.round(parsed.data.amount_eur * 100),
      is_default_open: parsed.data.is_default_open ?? false,
    })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/settings', 'page');
  return { ok: true } as const;
}

export async function deleteFee(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('tournament_fees').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/settings', 'page');
  return { ok: true } as const;
}
