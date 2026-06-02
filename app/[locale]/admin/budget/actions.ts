'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Categories = [
  'sponsorship',
  'donation',
  'other_income',
  'prizes',
  'snacks',
  'venue',
  'materials',
  'services',
  'other_expense',
] as const;

const EntrySchema = z.object({
  tournamentId: z.string().uuid(),
  kind: z.enum(['income', 'expense']),
  category: z.enum(Categories),
  label: z.string().trim().min(1).max(200),
  amount_eur: z.coerce.number().nonnegative().max(1000000),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional().nullable(),
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

function validateCategoryForKind(kind: 'income' | 'expense', category: string): boolean {
  const incomeCats = ['sponsorship', 'donation', 'other_income'];
  const expenseCats = ['prizes', 'snacks', 'venue', 'materials', 'services', 'other_expense'];
  return kind === 'income' ? incomeCats.includes(category) : expenseCats.includes(category);
}

export async function createBudgetEntry(formData: FormData) {
  const parsed = EntrySchema.safeParse({
    tournamentId: formData.get('tournamentId'),
    kind: formData.get('kind'),
    category: formData.get('category'),
    label: formData.get('label'),
    amount_eur: formData.get('amount_eur'),
    occurred_on: formData.get('occurred_on'),
    notes: (formData.get('notes') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;
  if (!validateCategoryForKind(parsed.data.kind, parsed.data.category)) {
    return { ok: false, error: 'category_kind_mismatch' } as const;
  }
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from('tournament_budget_entries').insert({
    tournament_id: parsed.data.tournamentId,
    kind: parsed.data.kind,
    category: parsed.data.category,
    label: parsed.data.label,
    amount_cents: Math.round(parsed.data.amount_eur * 100),
    occurred_on: parsed.data.occurred_on,
    notes: parsed.data.notes,
    created_by: auth.userId,
  });
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/budget', 'page');
  return { ok: true } as const;
}

export async function deleteBudgetEntry(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') return { ok: false, error: 'invalid_input' } as const;
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('tournament_budget_entries').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/budget', 'page');
  return { ok: true } as const;
}
