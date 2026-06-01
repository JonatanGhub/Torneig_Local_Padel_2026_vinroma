'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ScheduleSchema = z.object({
  matchId: z.string().uuid(),
  scheduledAt: z.string().min(1),
  courtLabel: z.string().min(1).max(40),
});

export type ScheduleMatchResult =
  | { ok: true; warning?: string }
  | {
      ok: false;
      error:
        | 'pair_double_booked'
        | 'court_double_booked'
        | 'invalid_input'
        | 'match_not_found'
        | string;
      conflictWith?: string;
    };

export async function scheduleMatch(formData: FormData): Promise<ScheduleMatchResult> {
  const parsed = ScheduleSchema.safeParse({
    matchId: formData.get('matchId'),
    scheduledAt: formData.get('scheduledAt'),
    courtLabel: formData.get('courtLabel'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const isoAt = new Date(parsed.data.scheduledAt).toISOString();
  const supabase = await createClient();

  // Carrega el match per saber les parelles implicades.
  const { data: thisMatch, error: thisErr } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id')
    .eq('id', parsed.data.matchId)
    .maybeSingle();
  if (thisErr || !thisMatch) {
    return { ok: false, error: thisErr?.message ?? 'match_not_found' };
  }

  // Carrega tots els partits del mateix slot horari (excloent ell mateix).
  const { data: pairConflicts } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, court_label')
    .eq('scheduled_at', isoAt)
    .neq('id', parsed.data.matchId);

  // 1) Bloqueig dur: alguna de les dues parelles ja té un partit a la mateixa
  //    hora exacta. No es pot jugar dos partits simultanis amb la mateixa parella.
  const pairClash = (pairConflicts ?? []).find(
    (m) =>
      m.pair_a_id === thisMatch.pair_a_id ||
      m.pair_a_id === thisMatch.pair_b_id ||
      m.pair_b_id === thisMatch.pair_a_id ||
      m.pair_b_id === thisMatch.pair_b_id,
  );
  if (pairClash) {
    return { ok: false, error: 'pair_double_booked', conflictWith: pairClash.id };
  }

  // 2) Bloqueig dur: ja hi ha un partit a la mateixa pista i a la mateixa
  //    hora. Una pista no pot tenir dos partits simultanis.
  const courtClash = (pairConflicts ?? []).find(
    (m) => m.court_label && m.court_label === parsed.data.courtLabel,
  );
  if (courtClash) {
    return { ok: false, error: 'court_double_booked', conflictWith: courtClash.id };
  }

  // 3) Advertència tova: ja hi ha algun altre partit a la mateixa data/hora
  //    (parelles i pistes diferents). Es permet però es retorna warning.
  const sameSlotCount = (pairConflicts ?? []).length;

  const { error } = await supabase.rpc('schedule_match', {
    p_match_id: parsed.data.matchId,
    p_scheduled_at: isoAt,
    p_court_label: parsed.data.courtLabel,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return sameSlotCount > 0 ? { ok: true, warning: 'same_time_other_match' } : { ok: true };
}

// =========================================================================
// Assignació automàtica d'horaris de fase de grups.
// Repartiment aleatori sobre dies dilluns–dijous del rang [first_match_at,
// final_at], a les pistes 2 i 3 (la 1 queda lliure), a les 19:00 i 20:30
// (i 22:00 només si no caben). Cap parella juga dos partits el mateix dia.
// Només toca partits de grup sense data (no sobreescriu res ja programat).
// =========================================================================

export type AutoScheduleResult =
  | { ok: true; assigned: number; unplaced: number; total: number }
  | { ok: false; error: 'dates_not_set' | 'no_match_days' | 'nothing_to_schedule' | string };

const PRIMARY_TIMES = ['19:00', '20:30'] as const;
const OVERFLOW_TIME = '22:00';
const COURTS = ['Pista 2', 'Pista 3'] as const;
// Offset d'estiu a Espanya (CEST). El torneig es juga al juliol/agost.
const SUMMER_OFFSET = '+02:00';

function matchDaysMonToThu(startISO: string, endISO: string): string[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const days: string[] = [];
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 12));
  while (cur <= last) {
    const dow = cur.getUTCDay(); // 0=diu … 6=dis
    if (dow >= 1 && dow <= 4) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cur.getUTCDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export async function autoScheduleGroupMatches(): Promise<AutoScheduleResult> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, first_match_at, final_at')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament?.first_match_at || !tournament?.final_at) {
    return { ok: false, error: 'dates_not_set' };
  }

  const days = matchDaysMonToThu(tournament.first_match_at, tournament.final_at);
  if (days.length === 0) return { ok: false, error: 'no_match_days' };

  const { data: matches } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id')
    .eq('tournament_id', tournament.id)
    .eq('phase', 'group')
    .eq('status', 'scheduled')
    .is('scheduled_at', null);
  if (!matches || matches.length === 0) {
    return { ok: false, error: 'nothing_to_schedule' };
  }

  type Slot = { day: string; iso: string; court: string };
  const primary: Slot[] = [];
  const overflow: Slot[] = [];
  for (const day of days) {
    for (const time of PRIMARY_TIMES) {
      for (const court of COURTS) {
        primary.push({ day, iso: `${day}T${time}:00${SUMMER_OFFSET}`, court });
      }
    }
    for (const court of COURTS) {
      overflow.push({ day, iso: `${day}T${OVERFLOW_TIME}:00${SUMMER_OFFSET}`, court });
    }
  }
  // Primer tots els slots principals de tots els dies; 22:00 només al final.
  const slots = [...primary, ...overflow];

  const pool = shuffle(matches);
  const playedByDay = new Map<string, Set<string>>();
  const assignments: { match_id: string; scheduled_at: string; court_label: string }[] = [];

  for (const slot of slots) {
    if (pool.length === 0) break;
    const played = playedByDay.get(slot.day) ?? new Set<string>();
    const idx = pool.findIndex((m) => !played.has(m.pair_a_id) && !played.has(m.pair_b_id));
    if (idx === -1) continue;
    const [m] = pool.splice(idx, 1);
    assignments.push({ match_id: m!.id, scheduled_at: slot.iso, court_label: slot.court });
    played.add(m!.pair_a_id);
    played.add(m!.pair_b_id);
    playedByDay.set(slot.day, played);
  }

  if (assignments.length > 0) {
    const { error } = await supabase.rpc('bulk_schedule_matches', {
      p_assignments: assignments,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return {
    ok: true,
    assigned: assignments.length,
    unplaced: pool.length,
    total: matches.length,
  };
}
