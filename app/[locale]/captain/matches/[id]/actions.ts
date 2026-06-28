'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categoryReadyForKnockout, generateKnockoutForCategory } from '@/lib/knockout';
import { madridInputToISO, madridDateKey } from '@/lib/format-date';
import {
  notifyMatchDisputed,
  notifyMatchValidated,
  notifyRescheduleProposed,
  notifyResultPendingValidation,
} from '@/lib/email/notify';
import {
  notifyMatchDisputedWhatsApp,
  notifyMatchValidatedWhatsApp,
  notifyRescheduleAcceptedToGroup,
  notifyRescheduleProposedWhatsApp,
  notifyResultPendingValidationWhatsApp,
  notifyValidatedToGroup,
} from '@/lib/whatsapp/notify';

const SetSchema = z.object({
  set: z.number().int().min(1).max(3),
  a: z.number().int().min(0).max(7),
  b: z.number().int().min(0).max(7),
});

const ScoreSchema = z.array(SetSchema).min(2).max(3);

function isValidPadelSet(games_a: number, games_b: number) {
  if (games_a === 6 && games_b <= 4) return true;
  if (games_b === 6 && games_a <= 4) return true;
  if (games_a === 7 && (games_b === 5 || games_b === 6)) return true;
  if (games_b === 7 && (games_a === 5 || games_a === 6)) return true;
  return false;
}

export async function submitReport(formData: FormData) {
  const matchId = formData.get('matchId');
  const raw = formData.get('score');
  if (typeof matchId !== 'string' || typeof raw !== 'string') {
    return { ok: false, error: 'invalid_input' } as const;
  }
  let parsedScore: unknown;
  try {
    parsedScore = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid_json' } as const;
  }
  const validated = ScoreSchema.safeParse(parsedScore);
  if (!validated.success) return { ok: false, error: 'invalid_score' } as const;
  for (const set of validated.data) {
    if (!isValidPadelSet(set.a, set.b)) return { ok: false, error: 'invalid_set_score' } as const;
  }
  let setsA = 0;
  let setsB = 0;
  for (const s of validated.data) {
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }
  if (setsA < 2 && setsB < 2) return { ok: false, error: 'no_winner' } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_match_report', {
    p_match_id: matchId,
    p_score: validated.data,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Tras el RPC, el trigger ya ha actualizado matches.status. Releemos
  // para decidir qué notificar. Errores de email no rompen la mutación.
  const { data: matchAfter } = await supabase
    .from('matches')
    .select('status, phase, category_id')
    .eq('id', matchId)
    .maybeSingle();
  const reporterSide = data === 'a' || data === 'b' ? (data as 'a' | 'b') : null;
  if (matchAfter?.status === 'validated') {
    await notifyMatchValidated(matchId);
    await notifyMatchValidatedWhatsApp(matchId);
    await notifyValidatedToGroup(matchId);
    // Si era l'últim partit de grup de la categoria, genera el quadre
    // automàticament (amb client de servei, que salta RLS). Errors aïllats.
    if (matchAfter.phase === 'group' && matchAfter.category_id) {
      try {
        const service = createServiceClient();
        if (await categoryReadyForKnockout(service, matchAfter.category_id)) {
          await generateKnockoutForCategory(service, matchAfter.category_id);
        }
      } catch (err) {
        console.warn('[knockout] auto-generate failed', err);
      }
    }
  } else if (matchAfter?.status === 'disputed') {
    await notifyMatchDisputed(matchId);
    await notifyMatchDisputedWhatsApp(matchId);
  } else if (matchAfter?.status === 'pending_validation' && reporterSide) {
    // Primer report: avisa el capità rival perquè el confirmi.
    await notifyResultPendingValidation(matchId, reporterSide);
    await notifyResultPendingValidationWhatsApp(matchId, reporterSide);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true, side: data as string } as const;
}

// =========================================================================
// Buscador de huecos OFICIALES libres para reprogramar.
// Horario oficial del torneo 2026: lunes–jueves, Pista 2 i Pista 3, a les
// 20:30 i 22:00. Només huecos fins al 30 de juliol (fi de fase de grups).
// Un hueco es "libre" si:
//   - és futur,
//   - cap altre partit ocupa la mateixa pista a la mateixa hora,
//   - cap dels 4 jugadors del partit ja juga aquella mateixa nit (per no
//     encadenar dos partits en una nit).
// =========================================================================

const OFFICIAL_TIMES = ['20:30', '22:00'] as const;
const OFFICIAL_COURTS = ['Pista 2', 'Pista 3'] as const;
const SUMMER_OFFSET = '+02:00';
const GROUP_PHASE_LAST_DAY = '2026-07-30';

export type FreeSlot = {
  // Valor per a <input datetime-local>: hora de paret de Madrid `YYYY-MM-DDTHH:mm`.
  scheduledAtInput: string;
  courtLabel: string;
  // Instant UTC, per ordenar i etiquetar.
  iso: string;
};

export type FreeSlotsResult =
  | { ok: true; slots: FreeSlot[] }
  | { ok: false; error: 'match_not_found' | string };

function officialDaysMonToThu(fromISO: string, toISO: string): string[] {
  const days: string[] = [];
  const startKey = madridDateKey(fromISO);
  const endKey = madridDateKey(toISO);
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!, 12));
  const last = new Date(Date.UTC(ey!, em! - 1, ed!, 12));
  while (cur <= last) {
    const dow = cur.getUTCDay();
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

export async function getFreeOfficialSlots(matchId: string): Promise<FreeSlotsResult> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('id, tournament_id, pair_a_id, pair_b_id')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: 'match_not_found' };

  const nowMs = Date.now();
  const days = officialDaysMonToThu(
    new Date(nowMs).toISOString(),
    `${GROUP_PHASE_LAST_DAY}T23:59:59${SUMMER_OFFSET}`,
  );
  if (days.length === 0) return { ok: true, slots: [] };

  // Partits ja programats al torneig → slots ocupats + nits en què juga
  // algun dels 4 jugadors d'aquest partit.
  const { data: scheduled } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, scheduled_at, court_label')
    .eq('tournament_id', match.tournament_id)
    .not('scheduled_at', 'is', null);

  const occupied = new Set<string>(); // `${instantUTC}|${court}`
  const involvedPairs = new Set([match.pair_a_id, match.pair_b_id]);
  const busyNights = new Set<string>(); // dies en què ja juga alguna de les 2 parelles
  for (const m of scheduled ?? []) {
    if (m.id === match.id || !m.scheduled_at) continue;
    const instant = new Date(m.scheduled_at).toISOString();
    if (m.court_label) occupied.add(`${instant}|${m.court_label}`);
    if (involvedPairs.has(m.pair_a_id) || involvedPairs.has(m.pair_b_id)) {
      busyNights.add(madridDateKey(m.scheduled_at));
    }
  }

  const slots: FreeSlot[] = [];
  for (const day of days) {
    if (busyNights.has(day)) continue; // no encadenar dos partits la mateixa nit
    for (const time of OFFICIAL_TIMES) {
      for (const court of OFFICIAL_COURTS) {
        const iso = new Date(`${day}T${time}:00${SUMMER_OFFSET}`).toISOString();
        if (new Date(iso).getTime() <= nowMs) continue;
        if (occupied.has(`${iso}|${court}`)) continue;
        slots.push({ scheduledAtInput: `${day}T${time}`, courtLabel: court, iso });
      }
    }
  }
  slots.sort((a, b) => a.iso.localeCompare(b.iso));
  return { ok: true, slots };
}

const RescheduleSchema = z.object({
  matchId: z.string().uuid(),
  newScheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'invalid_date',
  }),
  newCourtLabel: z.string().max(80).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
});

// Comprova si moure un partit a (whenISO, court) xocaria amb un altre partit:
// mateixa pista a la mateixa hora, o algun dels 4 jugadors ja jugant a aquella
// hora. És un avís ràpid; la garantia dura la dóna el trigger de la BD.
async function checkRescheduleConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  whenISO: string,
  newCourtLabel: string | null,
): Promise<'court_double_booked' | 'pair_double_booked' | null> {
  const { data: thisMatch } = await supabase
    .from('matches')
    .select('id, tournament_id, pair_a_id, pair_b_id, court_label')
    .eq('id', matchId)
    .maybeSingle();
  if (!thisMatch) return null;
  const court = newCourtLabel ?? thisMatch.court_label;

  const { data: others } = await supabase
    .from('matches')
    .select('id, court_label, pair_a_id, pair_b_id')
    .eq('tournament_id', thisMatch.tournament_id)
    .eq('scheduled_at', whenISO)
    .neq('id', matchId);
  if (!others || others.length === 0) return null;

  if (court && others.some((m) => m.court_label === court)) return 'court_double_booked';

  const pairIds = Array.from(
    new Set([
      thisMatch.pair_a_id,
      thisMatch.pair_b_id,
      ...others.flatMap((m) => [m.pair_a_id, m.pair_b_id]),
    ]),
  );
  const { data: prs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id')
    .in('id', pairIds);
  const playersByPair = new Map((prs ?? []).map((p) => [p.id, [p.player_a_id, p.player_b_id]]));
  const mine = new Set([
    ...(playersByPair.get(thisMatch.pair_a_id) ?? []),
    ...(playersByPair.get(thisMatch.pair_b_id) ?? []),
  ]);
  for (const m of others) {
    const theirs = [
      ...(playersByPair.get(m.pair_a_id) ?? []),
      ...(playersByPair.get(m.pair_b_id) ?? []),
    ];
    if (theirs.some((pid) => mine.has(pid))) return 'pair_double_booked';
  }
  return null;
}

export async function proposeReschedule(formData: FormData) {
  const parsed = RescheduleSchema.safeParse({
    matchId: formData.get('matchId'),
    newScheduledAt: formData.get('newScheduledAt'),
    newCourtLabel: (formData.get('newCourtLabel') as string | null) || null,
    message: (formData.get('message') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  // El valor ve d'un <input datetime-local> (hora de paret de Madrid). El
  // convertim a instant UTC tenint en compte el fus, no com a UTC directe.
  const whenISO = madridInputToISO(parsed.data.newScheduledAt);
  if (new Date(whenISO).getTime() <= Date.now()) {
    return { ok: false, error: 'new_date_must_be_future' } as const;
  }

  const supabase = await createClient();

  // Avís ràpid: no deixem ni proposar un canvi que ja xocaria amb un altre
  // partit (pista ocupada o parella jugant a aquella hora).
  const conflict = await checkRescheduleConflict(
    supabase,
    parsed.data.matchId,
    whenISO,
    parsed.data.newCourtLabel ?? null,
  );
  if (conflict) return { ok: false, error: conflict } as const;

  const { data, error } = await supabase.rpc('propose_reschedule', {
    p_match_id: parsed.data.matchId,
    p_new_scheduled_at: whenISO,
    p_new_court_label: parsed.data.newCourtLabel ?? null,
    p_message: parsed.data.message ?? null,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Notificar al capitán rival en background (errores no rompen la mutación).
  if (typeof data === 'string') {
    await notifyRescheduleProposed(data);
    await notifyRescheduleProposedWhatsApp(data);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  return { ok: true, proposalId: data as string } as const;
}

export async function respondToReschedule(formData: FormData) {
  const proposalId = formData.get('proposalId');
  const accept = formData.get('accept');
  if (typeof proposalId !== 'string' || (accept !== 'yes' && accept !== 'no')) {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const supabase = await createClient();

  // En acceptar, revalidem que el canvi no crei un conflicte (pot haver canviat
  // des que es va proposar). El trigger de la BD és la garantia final.
  if (accept === 'yes') {
    const { data: proposal } = await supabase
      .from('match_reschedule_proposals')
      .select('match_id, new_scheduled_at, new_court_label, status')
      .eq('id', proposalId)
      .maybeSingle();
    if (proposal && proposal.status === 'pending') {
      const whenISO = new Date(proposal.new_scheduled_at).toISOString();
      const conflict = await checkRescheduleConflict(
        supabase,
        proposal.match_id,
        whenISO,
        proposal.new_court_label ?? null,
      );
      if (conflict) return { ok: false, error: conflict } as const;
    }
  }

  const { data, error } = await supabase.rpc('respond_to_reschedule', {
    p_proposal_id: proposalId,
    p_accept: accept === 'yes',
  });
  if (error) {
    // El trigger matches_prevent_overlap pot rebutjar l'acceptació si crearia
    // un solapament: ho traduïm a un codi conegut per al missatge d'error.
    const msg = error.message ?? '';
    const code = msg.includes('court_double_booked')
      ? 'court_double_booked'
      : msg.includes('pair_double_booked')
        ? 'pair_double_booked'
        : msg;
    return { ok: false, error: code } as const;
  }

  // Si la proposta s'accepta, avisem el grup de gestió (canvi confirmat).
  // Errors de WhatsApp no han de trencar la mutació principal.
  if (data === 'accepted') {
    await notifyRescheduleAcceptedToGroup(proposalId);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return { ok: true, status: data as string } as const;
}

export async function cancelReschedule(formData: FormData) {
  const proposalId = formData.get('proposalId');
  if (typeof proposalId !== 'string') {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_reschedule', {
    p_proposal_id: proposalId,
  });
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  return { ok: true, status: data as string } as const;
}
