'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SponsorSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().max(2000),
  websiteUrl: z
    .string()
    .url()
    .max(2000)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  tier: z.enum(['gold', 'silver', 'bronze', 'collaborator']),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  roleCa: z
    .string()
    .max(120)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  roleEs: z
    .string()
    .max(120)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export async function upsertSponsor(formData: FormData) {
  const parsed = SponsorSchema.safeParse({
    id: (formData.get('id') as string | null) || null,
    name: formData.get('name'),
    logoUrl: formData.get('logoUrl'),
    websiteUrl: (formData.get('websiteUrl') as string | null) || null,
    tier: formData.get('tier'),
    displayOrder: formData.get('displayOrder') ?? 0,
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    roleCa: (formData.get('roleCa') as string | null) || null,
    roleEs: (formData.get('roleEs') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const supabase = await createClient();
  const payload = {
    name: parsed.data.name,
    logo_url: parsed.data.logoUrl,
    website_url: parsed.data.websiteUrl ?? null,
    tier: parsed.data.tier,
    display_order: parsed.data.displayOrder,
    is_active: parsed.data.isActive,
    role_ca: parsed.data.roleCa ?? null,
    role_es: parsed.data.roleEs ?? null,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from('sponsors').update(payload).eq('id', parsed.data.id);
    if (error) return { ok: false, error: error.message } as const;
  } else {
    const { error } = await supabase.from('sponsors').insert(payload);
    if (error) return { ok: false, error: error.message } as const;
  }

  revalidatePath('/[locale]/sponsors', 'page');
  revalidatePath('/[locale]/admin/sponsors', 'page');
  return { ok: true } as const;
}

export async function deleteSponsor(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') return { ok: false, error: 'invalid_input' } as const;
  const supabase = await createClient();
  const { error } = await supabase.from('sponsors').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/sponsors', 'page');
  revalidatePath('/[locale]/admin/sponsors', 'page');
  return { ok: true } as const;
}
