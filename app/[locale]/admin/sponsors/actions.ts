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

// =========================================================================
// Peticions de patrocini (taula `sponsor_requests`).
// =========================================================================

const RequestActionSchema = z.object({
  id: z.string().uuid(),
  adminNotes: z.string().max(1000).nullable().optional(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthenticated' as const };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false as const, error: 'forbidden' as const };
  return { ok: true as const, supabase, userId: user.id };
}

/**
 * Aprova una petició: crea l'entrada definitiva a `sponsors` (`is_active=true`)
 * amb les dades de la petició i marca la petició com a `approved`.
 */
export async function approveSponsorRequest(formData: FormData) {
  const parsed = RequestActionSchema.safeParse({
    id: formData.get('id'),
    adminNotes: (formData.get('adminNotes') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: req, error: readErr } = await auth.supabase
    .from('sponsor_requests')
    .select('*')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (readErr || !req)
    return { ok: false, error: readErr?.message ?? 'request_not_found' } as const;
  if (req.status !== 'pending') return { ok: false, error: 'already_reviewed' } as const;

  const { error: insErr } = await auth.supabase.from('sponsors').insert({
    name: req.name,
    logo_url: req.logo_url,
    website_url: req.website_url,
    tier: req.tier,
    role_ca: req.role_ca,
    role_es: req.role_es,
    display_order: 0,
    is_active: true,
  });
  if (insErr) return { ok: false, error: insErr.message } as const;

  const { error: updErr } = await auth.supabase
    .from('sponsor_requests')
    .update({
      status: 'approved',
      admin_notes: parsed.data.adminNotes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq('id', parsed.data.id);
  if (updErr) return { ok: false, error: updErr.message } as const;

  revalidatePath('/[locale]/sponsors', 'page');
  revalidatePath('/[locale]/admin/sponsors', 'page');
  return { ok: true } as const;
}

/** Rebutja una petició (no crea res a `sponsors`). */
export async function rejectSponsorRequest(formData: FormData) {
  const parsed = RequestActionSchema.safeParse({
    id: formData.get('id'),
    adminNotes: (formData.get('adminNotes') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from('sponsor_requests')
    .update({
      status: 'rejected',
      admin_notes: parsed.data.adminNotes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq('id', parsed.data.id)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/sponsors', 'page');
  return { ok: true } as const;
}

export async function deleteSponsorRequest(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') return { ok: false, error: 'invalid_input' } as const;
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('sponsor_requests').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/sponsors', 'page');
  return { ok: true } as const;
}
