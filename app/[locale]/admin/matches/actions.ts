'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { notifyMatchScheduled } from '@/lib/email/notify';
import { notifyMatchScheduledWhatsApp } from '@/lib/whatsapp/notify';
import { madridInputToISO, madridDateKey } from '@/lib/format-date';

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

  // El valor ve d'un <input datetime-local> que representa l'hora de paret de
  // Madrid. El convertim a UTC tenint en compte el fus (no com a UTC directe).
  const isoAt = madridInputToISO(parsed.data.scheduledAt);
  const supabase = await createClient();

  // Carrega el match per saber les parelles implicades.
  const { data: thisMatch, error: thisErr } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, scheduled_at')
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

  // Si el partit ja tenia data, és un canvi (notifiquem com a reprogramació).
  const isChange = Boolean(thisMatch.scheduled_at);

  const { error } = await supabase.rpc('schedule_match', {
    p_match_id: parsed.data.matchId,
    p_scheduled_at: isoAt,
    p_court_label: parsed.data.courtLabel,
  });
  if (error) return { ok: false, error: error.message };

  // Avisa els dos capitans (email + WhatsApp). Errors no bloquegen la mutació.
  await notifyMatchScheduled(parsed.data.matchId, isChange);
  await notifyMatchScheduledWhatsApp(parsed.data.matchId, isChange);

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return sameSlotCount > 0 ? { ok: true, warning: 'same_time_other_match' } : { ok: true };
}

// =========================================================================
// Proposta automàtica d'horaris de fase de grups.
// Repartiment aleatori sobre dies dilluns–dijous des de `first_match_at` fins
// al 30 de juliol (última nit de fase de grups; l'última setmana queda
// reservada per quarts, semifinals i finals). Només Pista 2 i Pista 3, a les
// 20:30 i 22:00 (4 partits per nit). Cap parella juga dos partits el mateix
// dia, i mai es proposa un slot (data+hora+pista) que ja estigui ocupat per
// un altre partit programat.
//
// Per garantir un calendari equilibrat:
//   - els partits es barregen interleavant els (categoria, grup) perquè cap
//     categoria s'acumuli;
//   - l'ordre dels slots també es barreja, per no omplir només els primers
//     dies del mes.
//
// IMPORTANT: aquesta acció NO desa res a la base de dades. Només calcula una
// proposta que omple els formularis del panell; l'admin ha de prémer "Desar"
// (per partit o "Desar tots els proposats") per confirmar les dates.
// =========================================================================

export type ProposedSlot = {
  matchId: string;
  // Valor per a <input datetime-local>: hora de paret de Madrid `YYYY-MM-DDTHH:mm`.
  scheduledAtInput: string;
  courtLabel: string;
};

export type ProposeAutoScheduleResult =
  | { ok: true; proposals: ProposedSlot[]; unplaced: number; total: number }
  | { ok: false; error: 'dates_not_set' | 'no_match_days' | 'nothing_to_schedule' | string };

const TIMES = ['20:30', '22:00'] as const;
const COURTS = ['Pista 2', 'Pista 3'] as const;
// Offset d'estiu a Espanya (CEST). El torneig es juga al juny/juliol/agost.
const SUMMER_OFFSET = '+02:00';
// Última nit per a partits de fase de grups. L'última setmana del torneig
// (3–7 ago) queda reservada per a quarts, semifinals i finals.
const GROUP_PHASE_LAST_DAY = '2026-07-30';

function matchDaysMonToThu(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  // Treballem amb la data de paret de Madrid per evitar desfasaments de dia.
  const startKey = madridDateKey(startISO);
  const endKey = madridDateKey(endISO);
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!, 12));
  const last = new Date(Date.UTC(ey!, em! - 1, ed!, 12));
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

// Barreja els elements interleaving per "bucket": cada ronda agafa un element
// de cada bucket no buit. Aplicat a (categoria, grup) garanteix que les
// categories es reparteixen pel mes en lloc de quedar agrupades.
function balancedShuffleByBucket<T>(items: T[], bucketKey: (t: T) => string): T[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = bucketKey(it);
    const arr = buckets.get(k) ?? [];
    arr.push(it);
    buckets.set(k, arr);
  }
  const queues = shuffle(Array.from(buckets.values()).map((arr) => shuffle(arr)));
  const out: T[] = [];
  while (queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

export async function proposeAutoSchedule(): Promise<ProposeAutoScheduleResult> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, first_match_at, final_at')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament?.first_match_at || !tournament?.final_at) {
    return { ok: false, error: 'dates_not_set' };
  }

  // Limitem la finestra de fase de grups al 30 de juliol (decisió organització
  // 2026): l'última setmana del torneig queda reservada per a l'eliminatòria.
  const groupEndISO = `${GROUP_PHASE_LAST_DAY}T23:59:59${SUMMER_OFFSET}`;
  const days = matchDaysMonToThu(tournament.first_match_at, groupEndISO);
  if (days.length === 0) return { ok: false, error: 'no_match_days' };

  const { data: matches } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, category_id, group_label')
    .eq('tournament_id', tournament.id)
    .eq('phase', 'group')
    .eq('status', 'scheduled')
    .is('scheduled_at', null);
  if (!matches || matches.length === 0) {
    return { ok: false, error: 'nothing_to_schedule' };
  }

  // Partits ja programats (qualsevol fase): ens diuen quins slots (data+hora+
  // pista) estan ocupats i quines parelles ja juguen un dia concret, perquè la
  // proposta no xoqui amb res existent.
  const { data: booked } = await supabase
    .from('matches')
    .select('pair_a_id, pair_b_id, scheduled_at, court_label')
    .eq('tournament_id', tournament.id)
    .not('scheduled_at', 'is', null);

  const occupied = new Set<string>(); // `${instantUTC}|${court}`
  const playedByDay = new Map<string, Set<string>>();
  for (const b of booked ?? []) {
    if (!b.scheduled_at) continue;
    const instant = new Date(b.scheduled_at).toISOString();
    if (b.court_label) occupied.add(`${instant}|${b.court_label}`);
    const dayKey = madridDateKey(b.scheduled_at);
    const set = playedByDay.get(dayKey) ?? new Set<string>();
    set.add(b.pair_a_id);
    set.add(b.pair_b_id);
    playedByDay.set(dayKey, set);
  }

  type Slot = { day: string; iso: string; court: string };
  const slots: Slot[] = [];
  for (const day of days) {
    for (const time of TIMES) {
      for (const court of COURTS) {
        slots.push({ day, iso: `${day}T${time}:00${SUMMER_OFFSET}`, court });
      }
    }
  }
  // Barreja l'ordre dels slots per evitar omplir només els primers dies. Així
  // els partits queden repartits al llarg de tot el mes.
  const shuffledSlots = shuffle(slots);

  // Pool balancejat per (categoria, grup) per evitar que totes les partides
  // d'una mateixa categoria es concentrin als mateixos dies.
  const pool = balancedShuffleByBucket(matches, (m) => `${m.category_id}|${m.group_label ?? ''}`);
  const proposals: ProposedSlot[] = [];

  for (const slot of shuffledSlots) {
    if (pool.length === 0) break;
    // Salta slots ja ocupats per partits programats.
    const instant = new Date(slot.iso).toISOString();
    if (occupied.has(`${instant}|${slot.court}`)) continue;

    const played = playedByDay.get(slot.day) ?? new Set<string>();
    const idx = pool.findIndex((m) => !played.has(m.pair_a_id) && !played.has(m.pair_b_id));
    if (idx === -1) continue;
    const [m] = pool.splice(idx, 1);

    // Marca aquest slot com a ocupat dins la mateixa proposta.
    occupied.add(`${instant}|${slot.court}`);
    const [, time] = slot.iso.split('T');
    proposals.push({
      matchId: m!.id,
      scheduledAtInput: `${slot.day}T${(time ?? '').slice(0, 5)}`,
      courtLabel: slot.court,
    });
    played.add(m!.pair_a_id);
    played.add(m!.pair_b_id);
    playedByDay.set(slot.day, played);
  }

  return {
    ok: true,
    proposals,
    unplaced: pool.length,
    total: matches.length,
  };
}

// Confirma (desa) un conjunt de propostes d'horari d'una sola vegada. Les
// propostes ja venen sense conflictes entre elles ni amb partits existents,
// però fem servir el mateix RPC de desat i avisem tots els capitans afectats.
const ConfirmSchema = z.object({
  assignments: z
    .array(
      z.object({
        matchId: z.string().uuid(),
        scheduledAtInput: z.string().min(1),
        courtLabel: z.string().min(1).max(40),
      }),
    )
    .min(1)
    .max(200),
});

export type ConfirmSchedulesResult =
  | { ok: true; saved: number }
  | { ok: false; error: 'invalid_input' | string };

export async function confirmSchedules(
  assignmentsInput: { matchId: string; scheduledAtInput: string; courtLabel: string }[],
): Promise<ConfirmSchedulesResult> {
  const parsed = ConfirmSchema.safeParse({ assignments: assignmentsInput });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const assignments = parsed.data.assignments.map((a) => ({
    match_id: a.matchId,
    scheduled_at: madridInputToISO(a.scheduledAtInput),
    court_label: a.courtLabel,
  }));

  const { error } = await supabase.rpc('bulk_schedule_matches', { p_assignments: assignments });
  if (error) return { ok: false, error: error.message };

  // Avisa els capitans (email + WhatsApp) en paral·lel; els errors no bloquegen.
  await Promise.allSettled(
    parsed.data.assignments.flatMap((a) => [
      notifyMatchScheduled(a.matchId, false),
      notifyMatchScheduledWhatsApp(a.matchId, false),
    ]),
  );

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return { ok: true, saved: assignments.length };
}
