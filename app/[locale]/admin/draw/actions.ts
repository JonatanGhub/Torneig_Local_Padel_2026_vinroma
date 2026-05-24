'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const DrawSchema = z.object({
  categoryId: z.string().uuid(),
  seed: z.coerce.number().int().min(0).max(999999),
});

export async function runDraw(formData: FormData) {
  const parsed = DrawSchema.safeParse({
    categoryId: formData.get('categoryId'),
    seed: formData.get('seed'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('run_draw', {
    p_category_id: parsed.data.categoryId,
    p_seed: parsed.data.seed,
  });

  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/draw', 'page');
  revalidatePath('/[locale]/grups', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true, groups: data ?? [] } as const;
}

const KnockoutSchema = z.object({ categoryId: z.string().uuid() });

export async function generateKnockout(formData: FormData) {
  const parsed = KnockoutSchema.safeParse({ categoryId: formData.get('categoryId') });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_knockout', {
    p_category_id: parsed.data.categoryId,
  });

  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/draw', 'page');
  revalidatePath('/[locale]/quadre', 'page');
  revalidatePath('/[locale]/quadre/[level]', 'page');
  return { ok: true, summary: data ?? '' } as const;
}

const ResetSchema = z.object({ categoryId: z.string().uuid() });

export async function resetDraw(formData: FormData) {
  const parsed = ResetSchema.safeParse({ categoryId: formData.get('categoryId') });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reset_draw', {
    p_category_id: parsed.data.categoryId,
  });

  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/draw', 'page');
  revalidatePath('/[locale]/grups', 'page');
  return { ok: true, deletedMatches: data ?? 0 } as const;
}
