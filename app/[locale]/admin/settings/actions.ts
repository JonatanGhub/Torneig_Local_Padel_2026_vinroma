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
