/**
 * Generació del quadre eliminatori d'una categoria a la base de dades, fent
 * servir el motor personalitzat (`lib/bracket-engine`).
 *
 * Insereix la PRIMERA ronda (phase 'ko_1' i 'cons_1'); el trigger SQL
 * `advance_knockout` ja s'encarrega de crear les rondes següents a mesura que
 * es tanquen els partits.
 *
 * S'usa des de dos llocs:
 *  - Botó d'admin "Generar quadre" (client amb sessió d'admin → RLS
 *    `matches_admin_write` permet l'insert).
 *  - Generació automàtica en validar-se l'últim partit de grup (client de
 *    servei → salta RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { computeCategoryBracket, type StandingRow, type GroupMeta } from '@/lib/bracket-engine';

type Client = SupabaseClient<Database>;

export type GenerateKnockoutResult =
  | { ok: true; main: number; cons: number }
  | {
      ok: false;
      error:
        | 'category_not_found'
        | 'draw_not_done'
        | 'group_phase_not_finished'
        | 'format_not_feasible'
        | 'knockout_already_generated'
        | 'incomplete_standings'
        | string;
    };

export async function generateKnockoutForCategory(
  supabase: Client,
  categoryId: string,
): Promise<GenerateKnockoutResult> {
  const { data: category } = await supabase
    .from('categories')
    .select('id, level, tournament_id')
    .eq('id', categoryId)
    .maybeSingle();
  if (!category) return { ok: false, error: 'category_not_found' };

  const { data: groups } = await supabase
    .from('groups')
    .select('id, label')
    .eq('category_id', categoryId);
  if (!groups || groups.length === 0) return { ok: false, error: 'draw_not_done' };

  // Ja generat? (filtrem en JS per evitar la sintaxi de wildcards de PostgREST)
  const { data: allPhases } = await supabase
    .from('matches')
    .select('phase')
    .eq('category_id', categoryId);
  if ((allPhases ?? []).some((m) => /^(ko|cons)_/.test(m.phase))) {
    return { ok: false, error: 'knockout_already_generated' };
  }

  const [{ data: standingsRows }, { data: groupMatches }] = await Promise.all([
    supabase
      .from('category_standings')
      .select('pair_id, group_id, matches_played, matches_won, sets_diff, games_diff')
      .eq('category_id', categoryId),
    supabase
      .from('matches')
      .select('group_label, status')
      .eq('category_id', categoryId)
      .eq('phase', 'group'),
  ]);

  const labelById = new Map(groups.map((g) => [g.id, g.label]));

  // Estat tancat per grup: tots els partits de grup validats/walkover.
  const closedByLabel = new Map<string, boolean>();
  for (const g of groups) closedByLabel.set(g.label, true);
  for (const m of groupMatches ?? []) {
    if (m.status !== 'validated' && m.status !== 'walkover') {
      if (m.group_label) closedByLabel.set(m.group_label, false);
    }
  }

  // Mida de cada grup = nombre de parelles a la classificació.
  const sizeByLabel = new Map<string, number>();
  const standings: StandingRow[] = [];
  for (const s of standingsRows ?? []) {
    const label = labelById.get(s.group_id);
    if (!label) continue;
    sizeByLabel.set(label, (sizeByLabel.get(label) ?? 0) + 1);
    standings.push({
      pair_id: s.pair_id,
      group_label: label,
      matches_played: Number(s.matches_played ?? 0),
      matches_won: Number(s.matches_won ?? 0),
      sets_diff: Number(s.sets_diff ?? 0),
      games_diff: Number(s.games_diff ?? 0),
    });
  }

  const groupMeta: GroupMeta[] = groups.map((g) => ({
    label: g.label,
    size: sizeByLabel.get(g.label) ?? 0,
    closed: closedByLabel.get(g.label) ?? false,
  }));

  const bracket = computeCategoryBracket(category.level, standings, groupMeta);
  if (!bracket.feasible) return { ok: false, error: 'format_not_feasible' };
  if (!bracket.groupPhaseFinished) return { ok: false, error: 'group_phase_not_finished' };

  // Construeix les files a inserir. Amb la fase de grups tancada, tots els
  // seeds han de ser parelles concretes.
  const rows: Database['public']['Tables']['matches']['Insert'][] = [];
  const pushRound = (
    matches: typeof bracket.main,
    phase: 'ko_1' | 'cons_1',
  ): 'incomplete_standings' | null => {
    for (const m of matches) {
      if (m.a.kind !== 'pair' || m.b.kind !== 'pair') return 'incomplete_standings';
      rows.push({
        tournament_id: category.tournament_id,
        category_id: categoryId,
        phase,
        group_label: String(m.position),
        pair_a_id: m.a.pair_id,
        pair_b_id: m.b.pair_id,
        status: 'scheduled',
      });
    }
    return null;
  };

  if (pushRound(bracket.main, 'ko_1') || pushRound(bracket.consolation, 'cons_1')) {
    return { ok: false, error: 'incomplete_standings' };
  }

  const { error } = await supabase.from('matches').insert(rows);
  if (error) return { ok: false, error: error.message };

  return { ok: true, main: bracket.main.length, cons: bracket.consolation.length };
}

/**
 * True si la categoria té la fase de grups acabada (té grups, té partits de
 * grup i tots estan validats/walkover) i encara no té quadre generat.
 * Útil per a la generació automàtica després de validar un resultat.
 */
export async function categoryReadyForKnockout(
  supabase: Client,
  categoryId: string,
): Promise<boolean> {
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('status')
    .eq('category_id', categoryId)
    .eq('phase', 'group');
  if (!groupMatches || groupMatches.length === 0) return false;
  const allDone = groupMatches.every((m) => m.status === 'validated' || m.status === 'walkover');
  if (!allDone) return false;

  const { data: phases } = await supabase
    .from('matches')
    .select('phase')
    .eq('category_id', categoryId);
  return !(phases ?? []).some((m) => /^(ko|cons)_/.test(m.phase));
}
