'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const EditPlayerSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(9).max(20),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tshirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  emergency_contact_name: z.string().trim().min(1).max(160),
  emergency_contact_phone: z.string().trim().min(9).max(20),
  consent_whatsapp: z.coerce.boolean(),
});

const EditPairSchema = z.object({
  pairId: z.string().uuid(),
  categoryId: z.string().uuid(),
  captainSide: z.enum(['a', 'b']),
  locale: z.enum(['ca', 'es']),
  playerA: EditPlayerSchema,
  playerB: EditPlayerSchema,
});

export type EditRegistrationResult =
  | { ok: true; categoryChanged: boolean; captainChanged: boolean }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | 'unauthenticated'
        | 'forbidden'
        | 'pair_not_found'
        | 'category_locked_by_draw'
        | 'category_locked_by_matches'
        | 'unknown_category'
        | 'duplicate_email'
        | string;
      field_errors?: Record<string, string>;
    };

export async function editPairRegistration(raw: unknown): Promise<EditRegistrationResult> {
  const parsed = EditPairSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { ok: false, error: 'invalid_input', field_errors: fieldErrors };
  }
  const data = parsed.data;

  // Els dos jugadors no poden tenir el mateix correu (igual que a la inscripció).
  if (data.playerA.email === data.playerB.email) {
    return {
      ok: false,
      error: 'duplicate_email',
      field_errors: { 'playerB.email': 'duplicate_email' },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  if ((user.app_metadata?.role as string | undefined) !== 'admin') {
    return { ok: false, error: 'forbidden' };
  }

  // Carrega la parella actual + categoria de destí.
  const { data: pair } = await supabase
    .from('pairs')
    .select('id, category_id, captain_id, player_a_id, player_b_id, group_id, tournament_id')
    .eq('id', data.pairId)
    .maybeSingle();
  if (!pair) return { ok: false, error: 'pair_not_found' };

  // Comprovacions per al canvi de categoria.
  const categoryChanged = pair.category_id !== data.categoryId;
  if (categoryChanged) {
    if (pair.group_id) {
      return { ok: false, error: 'category_locked_by_draw' };
    }
    const { count: matchesCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`pair_a_id.eq.${pair.id},pair_b_id.eq.${pair.id}`);
    if ((matchesCount ?? 0) > 0) {
      return { ok: false, error: 'category_locked_by_matches' };
    }
    const { data: newCategory } = await supabase
      .from('categories')
      .select('id, level')
      .eq('id', data.categoryId)
      .maybeSingle();
    if (!newCategory) return { ok: false, error: 'unknown_category' };
  }

  // Comprovació canvi de capità.
  const newCaptainId = data.captainSide === 'a' ? data.playerA.id : data.playerB.id;
  if (newCaptainId !== pair.player_a_id && newCaptainId !== pair.player_b_id) {
    return { ok: false, error: 'invalid_input' };
  }
  const captainChanged = pair.captain_id !== newCaptainId;

  // Nivell declarat = nivell de la categoria (compartit pels dos jugadors).
  let declared_level: number | null = null;
  if (categoryChanged) {
    const { data: cat } = await supabase
      .from('categories')
      .select('level')
      .eq('id', data.categoryId)
      .maybeSingle();
    declared_level = cat?.level ?? null;
  }

  // Snapshot per a l'audit_log.
  const { data: playersBefore } = await supabase
    .from('players')
    .select('*')
    .in('id', [data.playerA.id, data.playerB.id]);

  // Actualitzacions dels jugadors.
  for (const p of [data.playerA, data.playerB]) {
    const { error } = await supabase
      .from('players')
      .update({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        birth_date: p.birth_date,
        tshirt_size: p.tshirt_size,
        emergency_contact_name: p.emergency_contact_name,
        emergency_contact_phone: p.emergency_contact_phone,
        consent_whatsapp: p.consent_whatsapp,
        ...(declared_level !== null ? { declared_level } : {}),
      })
      .eq('id', p.id);
    if (error) return { ok: false, error: error.message };
  }

  // Actualització de la parella (si cal).
  if (categoryChanged || captainChanged) {
    const { error } = await supabase
      .from('pairs')
      .update({
        ...(categoryChanged ? { category_id: data.categoryId } : {}),
        ...(captainChanged ? { captain_id: newCaptainId } : {}),
      })
      .eq('id', pair.id);
    if (error) return { ok: false, error: error.message };
  }

  // Audit log: una entrada per jugador i, si cal, una per la parella.
  const auditRows: Array<{
    table_name: string;
    row_pk: string;
    operation: string;
    old_data: unknown;
    new_data: unknown;
    actor_id: string;
  }> = [];
  for (const p of [data.playerA, data.playerB]) {
    const before = playersBefore?.find((x) => x.id === p.id);
    auditRows.push({
      table_name: 'players',
      row_pk: p.id,
      operation: 'admin_edit',
      old_data: before ?? null,
      new_data: { ...p, ...(declared_level !== null ? { declared_level } : {}) },
      actor_id: user.id,
    });
  }
  if (categoryChanged || captainChanged) {
    auditRows.push({
      table_name: 'pairs',
      row_pk: pair.id,
      operation: 'admin_edit',
      old_data: { category_id: pair.category_id, captain_id: pair.captain_id },
      new_data: { category_id: data.categoryId, captain_id: newCaptainId },
      actor_id: user.id,
    });
  }
  if (auditRows.length) {
    await supabase.from('audit_log').insert(auditRows);
  }

  revalidatePath(`/${data.locale}/admin/registrations`);
  revalidatePath(`/${data.locale}/admin/registrations/${pair.id}/edit`);
  return { ok: true, categoryChanged, captainChanged };
}
