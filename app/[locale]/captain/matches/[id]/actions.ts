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

type StoredSet = { set: number; a: number; b: number };

// Compara el marcador que s'està enviant amb el que ja hi havia desat per al
// mateix reporter, per detectar un reenviament idèntic (doble clic, retry de
// xarxa...) i no tornar a disparar les notificacions. L'ordre dels sets pot
// variar segons com vingui de la BD, per això s'ordena abans de comparar.
function sameScore(a: unknown, b: StoredSet[]): boolean {
  if (!Array.isArray(a)) return false;
  const normalize = (arr: unknown[]) =>
    arr
      .filter(
        (s): s is StoredSet =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as StoredSet).set === 'number' &&
          typeof (s as StoredSet).a === 'number' &&
          typeof (s as StoredSet).b === 'number',
      )
      .map((s) => ({ set: s.set, a: s.a, b: s.b }))
      .sort((x, y) => x.set - y.set);
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length !== nb.length) return false;
  return na.every((s, i) => s.set === nb[i]!.set && s.a === nb[i]!.a && s.b === nb[i]!.b);
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

  // Comprova ABANS del RPC si aquest jugador ja tenia un report desat amb
  // exactament el mateix marcador. submit_match_report fa un upsert (mai
  // falla en un reenviament), així que sense aquesta comprovació un doble
  // clic o un retry de xarxa reenviaria les notificacions (WA/email) encara
  // que el resultat no hagi canviat gens.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let previousScore: unknown = null;
  if (user) {
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (player) {
      const { data: existingReport } = await supabase
        .from('match_reports')
        .select('score_json')
        .eq('match_id', matchId)
        .eq('reporter_player_id', player.id)
        .maybeSingle();
      previousScore = existingReport?.score_json ?? null;
    }
  }
  const isDuplicateResubmission =
    previousScore !== null && sameScore(previousScore, validated.data);

  const { data, error } = await supabase.rpc('submit_match_report', {
    p_match_id: matchId,
    p_score: validated.data,
  });
  if (error) return { ok: false, error: error.message } as const;

  if (isDuplicateResubmission) {
    console.log(
      '[submitReport] duplicate resubmission with identical score; skipping notifications',
      {
        matchId,
      },
    );
  } else {
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
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true, side: data as string } as const;
}

const WalkoverClaimSchema = z.enum(['we_retired', 'rival_retired']);

// Marcador parcial OPCIONAL i purament informatiu (p.ex. "anàvem 1-1, 2-0 al
// segon quan s'ha retirat"). No exigim sets complets vàlids de pàdel (per
// això existeix aquest flux!) — només rang de jocs 0-7, com un input normal.
const RealSetSchema = z.object({
  set: z.number().int().min(1).max(3),
  a: z.number().int().min(0).max(7),
  b: z.number().int().min(0).max(7),
});
const RealScoreSchema = z.array(RealSetSchema).max(3);

// Permet a un capità reportar un walkover (retirada/lesió o incompareixença)
// quan el partit s'ha interromput abans que ningú hagi pogut reportar un
// marcador vàlid (p.ex. una lesió deixa un set a mitges, que submitReport
// rebutjaria per no ser un set complet vàlid). El capità només indica QUI
// s'ha retirat; el RPC calcula el guanyador en termes absoluts i el desa
// com un match_report més, així que segueix el mateix circuit de doble
// confirmació (pending_validation/disputed) que un report normal. El
// marcador parcial opcional viatja a part i mai afecta qui guanya.
export async function submitWalkoverReport(formData: FormData) {
  const matchId = formData.get('matchId');
  if (typeof matchId !== 'string') return { ok: false, error: 'invalid_input' } as const;
  const parsedClaim = WalkoverClaimSchema.safeParse(formData.get('claim'));
  if (!parsedClaim.success) return { ok: false, error: 'invalid_input' } as const;

  const rawRealScore = formData.get('realScore');
  let realScore: z.infer<typeof RealScoreSchema> | null = null;
  if (typeof rawRealScore === 'string' && rawRealScore.trim()) {
    try {
      const parsedRealScore = RealScoreSchema.safeParse(JSON.parse(rawRealScore));
      if (!parsedRealScore.success) return { ok: false, error: 'invalid_score' } as const;
      if (parsedRealScore.data.length > 0) realScore = parsedRealScore.data;
    } catch {
      return { ok: false, error: 'invalid_json' } as const;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_match_walkover_report', {
    p_match_id: matchId,
    p_claim: parsedClaim.data,
    p_real_score: realScore,
  });
  if (error) {
    // Log sempre: sense això, un RPC fallit no deixa CAP rastre als logs de
    // Vercel (el POST retorna 200 amb {ok:false}) i diagnosticar "no em va
    // el botó" es torna impossible a posteriori.
    console.error('[submitWalkoverReport] rpc failed', { matchId, message: error.message });
    // Tradueix només codis coneguts; qualsevol altre missatge cru (p.ex. un
    // error de PostgREST) es mapeja a 'unknown' perquè t() no rebi una clau
    // inexistent i el capità vegi un error llegible.
    const known = [
      'invalid_claim',
      'invalid_real_score',
      'unauthenticated',
      'no_player_profile',
      'match_not_found',
      'match_already_resolved',
      'not_captain_of_this_match',
    ] as const;
    const code = known.find((k) => error.message.includes(k)) ?? 'unknown';
    return { ok: false, error: code } as const;
  }

  const { data: matchAfter } = await supabase
    .from('matches')
    .select('status, phase, category_id')
    .eq('id', matchId)
    .maybeSingle();
  const reporterSide = data === 'a' || data === 'b' ? (data as 'a' | 'b') : null;

  if (matchAfter?.status === 'validated' || matchAfter?.status === 'walkover') {
    // notifyMatchValidated (email) només actua sobre status==='validated', així
    // que per a un walkover ja tancat només s'envia WhatsApp (mateix criteri
    // que fa servir l'admin quan marca un walkover manualment).
    if (matchAfter.status === 'validated') await notifyMatchValidated(matchId);
    await notifyMatchValidatedWhatsApp(matchId);
    await notifyValidatedToGroup(matchId);
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
    await notifyResultPendingValidation(matchId, reporterSide);
    await notifyResultPendingValidationWhatsApp(matchId, reporterSide);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
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

// Errors coneguts de reprogramació (tenen traducció reschedule_error_*).
// Qualsevol altre missatge de la BD es mapeja a 'unknown' per no mostrar text
// cru a l'usuari.
const KNOWN_RESCHEDULE_ERRORS = [
  'invalid_input',
  'new_date_must_be_future',
  'court_double_booked',
  'pair_double_booked',
  'unauthenticated',
  'not_captain_of_this_match',
  'not_rival_captain',
  'match_already_finished',
  'proposal_not_pending',
  'only_proposer_can_cancel',
] as const;

function mapRescheduleError(msg: string): string {
  for (const code of KNOWN_RESCHEDULE_ERRORS) if (msg.includes(code)) return code;
  return 'unknown';
}

// Comprova si moure un partit a (whenISO, court) xocaria amb un altre partit:
// mateixa pista a la mateixa hora, o algun dels 4 jugadors ja jugant a aquella
// hora. És un avís ràpid; la garantia dura la dóna el trigger de la BD.
// Fa servir el client de servei (salta RLS) perquè el pre-check vegi totes les
// parelles encara que el torneig no estigui publicat.
async function checkRescheduleConflict(
  matchId: string,
  whenISO: string,
  newCourtLabel: string | null,
): Promise<'court_double_booked' | 'pair_double_booked' | null> {
  const supabase = createServiceClient();
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
  if (error) return { ok: false, error: mapRescheduleError(error.message ?? '') } as const;

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
  // Llegim l'hora antiga del partit ABANS que el RPC la sobreescrigui, per saber
  // si avui s'ha d'actualitzar el resum diari del grup.
  let oldScheduledAt: string | null = null;
  if (accept === 'yes') {
    const { data: proposal } = await supabase
      .from('match_reschedule_proposals')
      .select('match_id, new_scheduled_at, new_court_label, status')
      .eq('id', proposalId)
      .maybeSingle();
    if (proposal && proposal.status === 'pending') {
      const { data: matchNow } = await supabase
        .from('matches')
        .select('scheduled_at')
        .eq('id', proposal.match_id)
        .maybeSingle();
      oldScheduledAt = matchNow?.scheduled_at ?? null;

      const whenISO = new Date(proposal.new_scheduled_at).toISOString();
      const conflict = await checkRescheduleConflict(
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
  // El trigger matches_prevent_overlap pot rebutjar l'acceptació si crearia un
  // solapament: ho traduïm a un codi conegut per al missatge d'error.
  if (error) return { ok: false, error: mapRescheduleError(error.message ?? '') } as const;

  // Si la proposta s'accepta, avisem el grup de gestió (canvi confirmat).
  // Errors de WhatsApp no han de trencar la mutació principal.
  if (data === 'accepted') {
    await notifyRescheduleAcceptedToGroup(proposalId, oldScheduledAt);
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
  if (error) return { ok: false, error: mapRescheduleError(error.message ?? '') } as const;
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  return { ok: true, status: data as string } as const;
}
