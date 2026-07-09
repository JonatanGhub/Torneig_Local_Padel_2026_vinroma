/**
 * Avisos per WhatsApp (Evolution API), en paral·lel als emails.
 * Només s'envia a jugadors amb consent_whatsapp = true, telèfon i no anonimitzats.
 * Tots els errors es capturen: un fallo de WhatsApp mai bloqueja la mutació.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getSiteUrl } from '@/lib/site-url';
import { formatMatchTime, formatMatchDateTimeLong, madridDateKey } from '@/lib/format-date';
import { GROUP_PHASE_LAST_DAY } from '@/lib/scheduling/official-slots';
import { sendWhatsApp, sendWhatsAppToGroup, whatsappConfigured } from './send';

// Per obtenir el JID del grup de gestió:
//   GET <EVOLUTION_API_URL>/group/fetchAllGroups/<EVOLUTION_INSTANCE>
//   Headers: apikey: <EVOLUTION_API_KEY>
//   Busca el grup pel seu `subject` (nom) i agafa el camp `id`.
//   Defineix WHATSAPP_GROUP_JID amb aquest id (format: <digits>-<digits>@g.us).

const SITE_URL = getSiteUrl();

const ADMIN_WA = process.env.WHATSAPP_ADMIN_NUMBER ?? null;

type Captain = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  consent_whatsapp: boolean;
  is_anonymized: boolean;
};

function canWhatsApp(p: Captain | null | undefined): p is Captain {
  return Boolean(p && p.consent_whatsapp && !p.is_anonymized && p.phone);
}

function lastNamesPair(
  a?: { first_name?: string | null; last_name?: string | null } | null,
  b?: { first_name?: string | null; last_name?: string | null } | null,
): string {
  const name = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
    p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—' : '—';
  return `${name(a)} / ${name(b)}`;
}

function formatDateCA(iso: string | null): string {
  if (!iso) return 'sense data';
  try {
    // IMPORTANT: el servidor (Vercel) corre en UTC. Sense `timeZone` les hores
    // sortien 2h abans (p.ex. 18:30 enlloc de 20:30 a l'estiu). Cal forçar
    // Europe/Madrid perquè els avisos de WhatsApp mostrin l'hora real.
    return new Date(iso).toLocaleString('ca-ES', {
      timeZone: 'Europe/Madrid',
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

// 1) Resultat validat o walkover → WhatsApp als dos capitans
export async function notifyMatchValidatedWhatsApp(matchId: string) {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status, winner_pair_id')
      .eq('id', matchId)
      .maybeSingle();

    console.log('[whatsapp:notify] notifyMatchValidatedWhatsApp', {
      matchId,
      status: match?.status ?? 'not_found',
    });
    if (!match || (match.status !== 'validated' && match.status !== 'walkover')) return;
    const isWalkover = match.status === 'walkover';

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, captain_id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs || pairs.length < 2) return;

    const allPlayerIds = pairs.flatMap((p) => [p.captain_id, p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .in('id', allPlayerIds);

    let sets: { set_number: number; games_a: number; games_b: number }[] = [];
    if (!isWalkover) {
      const { data: setsData } = await supabase
        .from('sets')
        .select('set_number, games_a, games_b')
        .eq('match_id', matchId)
        .order('set_number', { ascending: true });
      sets = setsData ?? [];
    }

    // El marcador es desa sempre en l'ordre pair_a-pair_b. Si el missatge és
    // per a la parella B (que es mostra primera al text), cal INVERTIR cada
    // set; sinó el text mostra "la teva parella vs rival" amb un marcador que
    // en realitat és rival-tu, donant la falsa impressió d'haver guanyat.
    const scoreTextFor = (forPairId: string) => {
      const flip = forPairId === match.pair_b_id;
      return (
        sets
          .map((s) => (flip ? `${s.games_b}-${s.games_a}` : `${s.games_a}-${s.games_b}`))
          .join(', ') || '—'
      );
    };

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPair(
        players?.find((p) => p.id === pair.player_a_id),
        players?.find((p) => p.id === pair.player_b_id),
      );
    };

    for (const pair of pairs) {
      const captain = players?.find((p) => p.id === pair.captain_id) as Captain | undefined;
      if (!canWhatsApp(captain)) continue;
      const won = match.winner_pair_id === pair.id;
      const rivalPairId = pair.id === match.pair_a_id ? match.pair_b_id : match.pair_a_id;
      const text = isWalkover
        ? `🎾 *Resultat: Walkover*\n` +
          `${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}\n` +
          `${won ? '✅ Heu guanyat per walkover!' : '❌ Heu perdut per walkover.'}\n\n` +
          `${SITE_URL}/ca/captain`
        : `🎾 *Resultat validat*\n` +
          `${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}\n` +
          `Marcador: ${scoreTextFor(pair.id)}\n` +
          `${won ? '✅ Heu guanyat!' : 'Sort la propera!'}\n\n` +
          `${SITE_URL}/ca/captain`;
      await sendWhatsApp({ to: captain.phone, text });
    }
  } catch (err) {
    console.warn('[whatsapp] notifyMatchValidated failed', err);
  }
}

// 2) Canvi de partit proposat → WhatsApp al capità rival
export async function notifyRescheduleProposedWhatsApp(proposalId: string) {
  try {
    const supabase = createServiceClient();
    const { data: proposal } = await supabase
      .from('match_reschedule_proposals')
      .select('id, match_id, proposer_pair_side, new_scheduled_at, new_court_label, message')
      .eq('id', proposalId)
      .maybeSingle();
    if (!proposal) return;

    const { data: match } = await supabase
      .from('matches')
      .select('id, category_id, pair_a_id, pair_b_id')
      .eq('id', proposal.match_id)
      .maybeSingle();
    if (!match) return;

    // Les dues parelles del partit, per indicar QUIN partit és al missatge.
    const { data: matchPairs } = await supabase
      .from('pairs')
      .select('id, captain_id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    const mpPlayerIds = (matchPairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: mpNames } = mpPlayerIds.length
      ? await supabase.from('players').select('id, first_name, last_name').in('id', mpPlayerIds)
      : { data: [] };
    const labelOf = (pairId: string) => {
      const p = matchPairs?.find((x) => x.id === pairId);
      if (!p) return '—';
      return lastNamesPair(
        mpNames?.find((n) => n.id === p.player_a_id),
        mpNames?.find((n) => n.id === p.player_b_id),
      );
    };
    const matchLabel = `${labelOf(match.pair_a_id)} vs ${labelOf(match.pair_b_id)}`;

    const { data: category } = await supabase
      .from('categories')
      .select('name_ca')
      .eq('id', match.category_id)
      .maybeSingle();

    const rivalPairId = proposal.proposer_pair_side === 'a' ? match.pair_b_id : match.pair_a_id;
    const rivalPair = matchPairs?.find((p) => p.id === rivalPairId);
    if (!rivalPair) return;

    const { data: rivalCaptain } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .eq('id', rivalPair.captain_id)
      .maybeSingle();
    if (!canWhatsApp(rivalCaptain as Captain | null)) return;

    const text =
      `📅 *Proposta de canvi de partit*\n` +
      `*${matchLabel}*${category?.name_ca ? ` · ${category.name_ca}` : ''}\n` +
      `Nova data: ${formatDateCA(proposal.new_scheduled_at)}\n` +
      (proposal.new_court_label ? `Pista: ${proposal.new_court_label}\n` : '') +
      (proposal.message ? `Missatge: ${proposal.message}\n` : '') +
      `\nConfirma o rebutja aquí:\n${SITE_URL}/ca/captain/matches/${proposal.match_id}/reschedule`;
    await sendWhatsApp({ to: rivalCaptain!.phone, text });
  } catch (err) {
    console.warn('[whatsapp] notifyRescheduleProposed failed', err);
  }
}

// 3) Disputa → WhatsApp a l'organització (si hi ha WHATSAPP_ADMIN_NUMBER)
export async function notifyMatchDisputedWhatsApp(matchId: string) {
  if (!ADMIN_WA) return;
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.status !== 'disputed') return;

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);
    const pairLabelOf = (pairId: string) => {
      const pair = pairs?.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPair(
        players?.find((p) => p.id === pair.player_a_id),
        players?.find((p) => p.id === pair.player_b_id),
      );
    };

    const text =
      `⚠️ *Partit en disputa*\n` +
      `${pairLabelOf(match.pair_a_id)} vs ${pairLabelOf(match.pair_b_id)}\n` +
      `Cal resoldre des de l'admin:\n${SITE_URL}/ca/admin/disputes`;
    await sendWhatsApp({ to: ADMIN_WA, text });
  } catch (err) {
    console.warn('[whatsapp] notifyMatchDisputed failed', err);
  }
}

// 4) Resultat reportat (pendent de validar) → WhatsApp al capità RIVAL
//    (el que encara no ha reportat) perquè el confirmi a l'app.
export async function notifyResultPendingValidationWhatsApp(
  matchId: string,
  reporterSide: 'a' | 'b',
) {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.status !== 'pending_validation') return;

    const rivalPairId = reporterSide === 'a' ? match.pair_b_id : match.pair_a_id;
    const reporterPairId = reporterSide === 'a' ? match.pair_a_id : match.pair_b_id;

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, captain_id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs) return;

    const allPlayerIds = pairs.flatMap((p) => [p.captain_id, p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .in('id', allPlayerIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPair(
        players?.find((p) => p.id === pair.player_a_id),
        players?.find((p) => p.id === pair.player_b_id),
      );
    };

    const rivalPair = pairs.find((p) => p.id === rivalPairId);
    if (!rivalPair) {
      console.warn('[whatsapp] notifyResultPendingValidation: rival pair not found', {
        matchId,
        rivalPairId,
      });
      return;
    }
    const rivalCaptain = players?.find((p) => p.id === rivalPair.captain_id) as Captain | undefined;
    const rivalDebugInfo = {
      rivalCaptainId: rivalCaptain?.id ?? null,
      hasPhone: Boolean(rivalCaptain?.phone),
      consentWhatsapp: rivalCaptain?.consent_whatsapp ?? null,
      isAnonymized: rivalCaptain?.is_anonymized ?? null,
    };
    if (!canWhatsApp(rivalCaptain)) {
      // Sense això, un capità que no rep l'avís (sense telèfon, sense
      // consentiment, o anonimitzat) no deixa cap rastre — impossible de
      // diagnosticar a posteriori quan algú diu "no m'ha arribat cap avís".
      console.warn(
        '[whatsapp] notifyResultPendingValidation: rival captain cannot receive WhatsApp',
        { matchId, ...rivalDebugInfo },
      );
      return;
    }

    const { data: report } = await supabase
      .from('match_reports')
      .select('score_json')
      .eq('match_id', matchId)
      .eq('reporter_pair_side', reporterSide)
      .maybeSingle();
    const walkoverSets = Array.isArray(report?.score_json)
      ? (report!.score_json as {
          a: number;
          b: number;
          wo?: boolean;
          wo_real_score?: { a: number; b: number }[];
        }[])
      : null;
    const isWalkoverClaim = walkoverSets?.[0]?.wo === true;
    // El score_json d'un walkover es desa en termes ABSOLUTS (a=pair_a,
    // b=pair_b), a diferència d'un report normal (relatiu al que reporta).
    // Per això calculem qui guanya/es retira a partir del propi marcador,
    // no de qui ha enviat el report (podria ser qualsevol dels dos costats).
    const winnerPairId =
      isWalkoverClaim && walkoverSets![0]!.a > walkoverSets![0]!.b
        ? match.pair_a_id
        : match.pair_b_id;
    const retiredPairId = winnerPairId === match.pair_a_id ? match.pair_b_id : match.pair_a_id;
    const scoreText = walkoverSets ? walkoverSets.map((s) => `${s.a}-${s.b}`).join(', ') : '—';
    // Marcador parcial opcional que el capità pot haver afegit; purament
    // informatiu, ja desat en termes absoluts com la resta del walkover.
    const realScoreText = walkoverSets?.[0]?.wo_real_score?.map((s) => `${s.a}-${s.b}`).join(', ');

    const text = isWalkoverClaim
      ? `📝 *Walkover per confirmar*\n` +
        `${pairLabelOf(reporterPairId)} indica que ${pairLabelOf(retiredPairId)} s'ha retirat o no s'ha presentat (guanyaria ${pairLabelOf(winnerPairId)}).\n` +
        (realScoreText ? `Marcador quan s'ha aturat: ${realScoreText}\n` : '') +
        `\nConfirma-ho (o reporta el resultat real si el partit sí que s'ha jugat):\n` +
        `${SITE_URL}/ca/captain/matches/${matchId}`
      : `📝 *Resultat per confirmar*\n` +
        `${pairLabelOf(reporterPairId)} ha reportat: ${scoreText}\n` +
        `vs ${pairLabelOf(rivalPairId)}\n\n` +
        `Confirma'l (o reporta el teu) a l'app perquè quedi validat:\n` +
        `${SITE_URL}/ca/captain/matches/${matchId}`;
    await sendWhatsApp({ to: rivalCaptain!.phone, text });
  } catch (err) {
    console.error(
      '[whatsapp] notifyResultPendingValidation failed',
      { matchId, reporterSide },
      err,
    );
  }
}

// 5) Recordatori de partit → WhatsApp als dos capitans (cridat des del cron)
// 4b) Partit programat/reprogramat per l'admin → WhatsApp als dos capitans.
export async function notifyMatchScheduledWhatsApp(matchId: string, isChange: boolean) {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, scheduled_at, court_label')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || !match.scheduled_at) return;

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, captain_id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs || pairs.length < 2) return;

    const allPlayerIds = pairs.flatMap((p) => [p.captain_id, p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .in('id', allPlayerIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPair(
        players?.find((p) => p.id === pair.player_a_id),
        players?.find((p) => p.id === pair.player_b_id),
      );
    };

    for (const pair of pairs) {
      const captain = players?.find((p) => p.id === pair.captain_id) as Captain | undefined;
      if (!canWhatsApp(captain)) continue;
      const rivalPairId = pair.id === match.pair_a_id ? match.pair_b_id : match.pair_a_id;
      const text =
        `${isChange ? '🔁 *Canvi d horari*' : '🗓️ *Nou partit programat*'}\n` +
        `${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}\n` +
        `📅 ${formatDateCA(match.scheduled_at)}\n` +
        (match.court_label ? `📍 ${match.court_label}\n` : '') +
        `\nEl teu calendari:\n${SITE_URL}/ca/captain/calendari`;
      await sendWhatsApp({ to: captain.phone, text });
    }
  } catch (err) {
    console.warn('[whatsapp] notifyMatchScheduled failed', err);
  }
}

// 4c) Pagament conciliat per l'admin → WhatsApp al capità.
export async function notifyPaymentReconciledWhatsApp(paymentId: string) {
  try {
    const supabase = createServiceClient();
    const { data: payment } = await supabase
      .from('payments')
      .select('id, pair_id, amount_cents')
      .eq('id', paymentId)
      .maybeSingle();
    if (!payment) return;

    const { data: pair } = await supabase
      .from('pairs')
      .select('id, captain_id')
      .eq('id', payment.pair_id)
      .maybeSingle();
    if (!pair) return;

    const { data: captain } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .eq('id', pair.captain_id)
      .maybeSingle();
    if (!canWhatsApp(captain as Captain | null)) return;

    const amountLabel = new Intl.NumberFormat('ca-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format((payment.amount_cents ?? 0) / 100);

    const text =
      `💸 *Pagament confirmat*\n` +
      `Hem rebut el teu pagament de ${amountLabel}. La teva parella ja està confirmada!\n\n` +
      `${SITE_URL}/ca/captain`;
    await sendWhatsApp({ to: captain!.phone, text });
  } catch (err) {
    console.warn('[whatsapp] notifyPaymentReconciled failed', err);
  }
}

// =========================================================================
// Avisos al GRUP de gestió de WhatsApp (paral·lels als DMs als capitans).
// Tots passen per sendWhatsAppToGroup() que ja és no-op si WHATSAPP_GROUP_JID
// no està definit. Mai llancen.
// =========================================================================

type PlayerLite = { id: string; first_name: string | null; last_name: string | null };

function lastNamesPairFromPlayers(
  players: PlayerLite[] | null | undefined,
  playerAId: string | null | undefined,
  playerBId: string | null | undefined,
): string {
  return lastNamesPair(
    players?.find((p) => p.id === playerAId),
    players?.find((p) => p.id === playerBId),
  );
}

// 6) Resultat validat o walkover → missatge al grup amb el marcador oficial.
export async function notifyValidatedToGroup(matchId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status, winner_pair_id, category_id, group_label')
      .eq('id', matchId)
      .maybeSingle();

    console.log('[whatsapp:notify] notifyValidatedToGroup', {
      matchId,
      status: match?.status ?? 'not_found',
    });
    if (!match || (match.status !== 'validated' && match.status !== 'walkover')) return;
    const isWalkover = match.status === 'walkover';

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs || pairs.length < 2) return;

    const playerIds = pairs.flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);

    let scoreText = 'Walkover';
    if (!isWalkover) {
      const { data: sets } = await supabase
        .from('sets')
        .select('set_number, games_a, games_b')
        .eq('match_id', matchId)
        .order('set_number', { ascending: true });
      scoreText = (sets ?? []).map((s) => `${s.games_a}-${s.games_b}`).join(', ') || '—';
    }

    const { data: category } = await supabase
      .from('categories')
      .select('name_ca, level')
      .eq('id', match.category_id)
      .maybeSingle();

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPairFromPlayers(players, pair.player_a_id, pair.player_b_id);
    };

    const labelA = pairLabelOf(match.pair_a_id);
    const labelB = pairLabelOf(match.pair_b_id);
    const winnerLabel = match.winner_pair_id ? pairLabelOf(match.winner_pair_id) : null;
    const categoryName = category?.name_ca ?? '—';
    const groupSuffix = match.group_label ? `  ·  Grup ${match.group_label}` : '';
    const standingsUrl = category?.level
      ? `${SITE_URL}/ca/grups/${category.level}`
      : `${SITE_URL}/ca/grups`;

    const text = isWalkover
      ? `🎾 *Resultat oficial — Walkover*\n` +
        `${labelA}  vs  ${labelB}\n` +
        (winnerLabel ? `Guanya: ${winnerLabel}\n` : '') +
        `Categoria: ${categoryName}${groupSuffix}\n\n` +
        `📊 Classificació actualitzada:\n${standingsUrl}`
      : `✅ *Resultat oficial*\n` +
        `${labelA}  vs  ${labelB}\n` +
        `Marcador: ${scoreText}\n` +
        (winnerLabel ? `Guanya: ${winnerLabel}\n` : '') +
        `Categoria: ${categoryName}${groupSuffix}\n\n` +
        `📊 Classificació actualitzada:\n${standingsUrl}`;

    await sendWhatsAppToGroup(text);
  } catch (err) {
    console.warn('[whatsapp] notifyValidatedToGroup failed', err);
  }
}

// 7) Canvi de partit acceptat → missatge al grup amb la nova data/pista.
//    Si el canvi afecta avui (l'hora antiga o la nova és avui), re-envia el
//    resum diari actualitzat perquè el "Avui es juga" del matí no quedi obsolet.
// Hora (Madrid) del cron oficial "Avui es juga" (vercel.json: "0 6 * * *" =
// 06:00 UTC = 08:00 Madrid a l'estiu/CEST). Ha de coincidir amb aquell cron.
const DAILY_SUMMARY_HOUR_MADRID = 8;

// Si ja ha passat l'hora del resum oficial d'avui, un canvi de partit d'avui
// ha d'enviar una actualització immediata (l'oficial ja es va enviar sense
// aquest canvi). Si encara no ha passat, no cal res: el cron oficial d'avui
// encara no s'ha executat i ja recollirà l'estat actual quan es dispari.
function isPastDailySummaryTime(now: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now);
    let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    if (hour === 24) hour = 0;
    return hour >= DAILY_SUMMARY_HOUR_MADRID;
  } catch {
    return true; // si no podem determinar l'hora, enviem l'avís per seguretat
  }
}

export async function notifyRescheduleAcceptedToGroup(
  proposalId: string,
  oldScheduledAt?: string | null,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: proposal } = await supabase
      .from('match_reschedule_proposals')
      .select('id, match_id, status, new_scheduled_at, new_court_label')
      .eq('id', proposalId)
      .maybeSingle();
    if (!proposal || proposal.status !== 'accepted') return;

    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id')
      .eq('id', proposal.match_id)
      .maybeSingle();
    if (!match) return;

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs || pairs.length < 2) return;

    const playerIds = pairs.flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPairFromPlayers(players, pair.player_a_id, pair.player_b_id);
    };

    const labelA = pairLabelOf(match.pair_a_id);
    const labelB = pairLabelOf(match.pair_b_id);
    const dateText = formatDateCA(proposal.new_scheduled_at);
    const courtText = proposal.new_court_label ?? '—';

    const text =
      `📅 *Canvi de partit confirmat*\n` +
      `${labelA}  vs  ${labelB}\n` +
      `Nova data: ${dateText}  ·  ${courtText}\n\n` +
      `🗓️ Calendari complet:\n${SITE_URL}/ca/calendari`;

    await sendWhatsAppToGroup(text);

    // Si avui és el dia afectat (l'hora vella o la nova), cal decidir si
    // reenviem el resum "actualitzat":
    //  - Si encara NO ha passat l'hora del resum oficial d'avui (08:00 Madrid),
    //    NO enviem res ara: el cron oficial encara no s'ha disparat i ja
    //    recollirà aquest canvi ell mateix quan s'executi. Enviar-ne un altre
    //    ara només duplicaria l'avís (el que vam veure abans de les 08:00).
    //  - Si l'oficial d'avui YA s'ha enviat (som després de les 08:00), el
    //    canvi l'ha deixat desactualitzat, així que sí que cal l'actualització.
    const todayKey = madridDateKey(new Date().toISOString());
    const affectsToday =
      (proposal.new_scheduled_at && madridDateKey(proposal.new_scheduled_at) === todayKey) ||
      (oldScheduledAt && madridDateKey(oldScheduledAt) === todayKey);
    if (affectsToday) {
      if (isPastDailySummaryTime()) {
        await sendDailyGroupSummary({ isUpdate: true });
      } else {
        console.log(
          '[whatsapp] reschedule affects today but before the official daily summary time; skipping immediate update (the official cron will include it)',
        );
      }
    }
  } catch (err) {
    console.warn('[whatsapp] notifyRescheduleAcceptedToGroup failed', err);
  }
}

// 8) Resum diari "Avui es juga" → missatge al grup amb tots els partits del dia.
//    Cridat des del cron diari (08:00 Madrid).
const MADRID_TZ = 'Europe/Madrid';

function madridYmdToday(now: Date = new Date()): { y: number; m: number; d: number } {
  // Intl ens dona la Y-M-D en zona Europe/Madrid sense haver de càrregar tz libs.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function madridDayWindowIso(now: Date = new Date()): { startIso: string; endIso: string } {
  // El torneig és a l'estiu (juliol-agost) → Madrid és UTC+02:00 (CEST).
  // Construïm la finestra [00:00, 24:00) del dia local de Madrid en ISO.
  const { y, m, d } = madridYmdToday(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startIso = `${y}-${pad(m)}-${pad(d)}T00:00:00+02:00`;
  // Sumar 24h al moment d'inici per evitar errors d'aritmètica de calendari.
  const endIso = new Date(new Date(startIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return { startIso, endIso };
}

function formatMadridDateLong(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      timeZone: MADRID_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatMadridTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      timeZone: MADRID_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

// Cert si avui (hora de Madrid) és un dia oficial de joc del torneig
// (dilluns–dijous). Els forats oficials són dl–dj; divendres–diumenge no
// s'espera cap partit, així que no cal avisar que "no es juga".
function isOfficialPlayDayMadrid(now: Date = new Date()): boolean {
  try {
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: MADRID_TZ,
      weekday: 'short',
    }).format(now);
    return wd === 'Mon' || wd === 'Tue' || wd === 'Wed' || wd === 'Thu';
  } catch {
    return false;
  }
}

export async function sendDailyGroupSummary(opts?: { isUpdate?: boolean }): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { startIso, endIso } = madridDayWindowIso();

    const { data: matches } = await supabase
      .from('matches')
      .select('id, scheduled_at, court_label, pair_a_id, pair_b_id, category_id, status')
      .in('status', ['scheduled', 'pending_validation'])
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true });

    if (!matches || matches.length === 0) {
      // Sense partits avui. Només avisem que "no es juga" els dies OFICIALS
      // de joc (dl–dj) — perquè la gent que espera partits aquells dies tingui
      // confirmació que el sistema funciona i que realment no toca — i només
      // si el torneig encara no ha acabat (queda algun partit futur). Els caps
      // de setmana i un cop tancat el torneig callem, per no fer soroll. Mai
      // en una actualització per reprogramació (isUpdate).
      if (!opts?.isUpdate && isOfficialPlayDayMadrid()) {
        const { count } = await supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled')
          .gte('scheduled_at', endIso);
        if ((count ?? 0) > 0) {
          const day = formatMadridDateLong(new Date(startIso));
          await sendWhatsAppToGroup(`🎾 *Avui no es juga cap partit del torneig* (${day})`);
        }
      }
      return;
    }

    const pairIds = Array.from(new Set(matches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', pairIds);

    const playerIds = Array.from(
      new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])),
    );
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);

    const categoryIds = Array.from(new Set(matches.map((m) => m.category_id)));
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name_ca')
      .in('id', categoryIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs?.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPairFromPlayers(players, pair.player_a_id, pair.player_b_id);
    };
    const categoryNameOf = (categoryId: string) =>
      categories?.find((c) => c.id === categoryId)?.name_ca ?? '—';

    const lines = matches.map((m) => {
      const time = formatMadridTime(m.scheduled_at);
      const court = m.court_label ?? '—';
      const cat = categoryNameOf(m.category_id);
      const labelA = pairLabelOf(m.pair_a_id);
      const labelB = pairLabelOf(m.pair_b_id);
      return `• ${time} · ${court} · ${cat} · ${labelA} vs ${labelB}`;
    });

    const day = formatMadridDateLong(new Date(startIso));
    const header = opts?.isUpdate
      ? `🔄 *Avui es juga — actualitzat (${day})*`
      : `🎾 *Avui es juga (${day})*`;
    const text =
      `${header}\n\n${lines.join('\n')}\n\n` +
      `🗓️ Calendari complet:\n${SITE_URL}/ca/calendari\n` +
      `Bona sort!`;

    await sendWhatsAppToGroup(text);
  } catch (err) {
    console.warn('[whatsapp] sendDailyGroupSummary failed', err);
  }
}

function formatMadridDayMonth(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      timeZone: MADRID_TZ,
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function weekdayCA(iso: string): string {
  try {
    const label = new Intl.DateTimeFormat('ca-ES', {
      timeZone: MADRID_TZ,
      weekday: 'long',
    }).format(new Date(iso));
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return '';
  }
}

// Finestra [dilluns 00:00, dilluns següent 00:00) en hora de Madrid de la
// propera setmana sencera (dilluns a diumenge). Pensada per executar-se en
// diumenge (el cron setmanal), però si es crida un altre dia calcula el
// proper dilluns endavant (avui inclòs si avui ja és dilluns).
//
// Cobreix tota la setmana (no només dilluns-dijous de l'horari oficial)
// perquè un partit reprogramat fora d'horari (divendres, dissabte o
// diumenge) també surti en aquest avís previ — el resum diari ja l'anuncia
// el dia que toca, però sense aquesta finestra ampliada no sortiria aquí.
function nextWeekWindowIso(now: Date = new Date()): {
  startIso: string;
  endIso: string;
  mondayDate: Date;
  sundayDate: Date;
} {
  const { y, m, d } = madridYmdToday(now);
  const todayUTC = new Date(Date.UTC(y, m - 1, d));
  const dow = todayUTC.getUTCDay(); // 0=diumenge, 1=dilluns, ...
  const daysUntilMonday = (8 - dow) % 7;
  const mondayDate = new Date(todayUTC.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startIso = `${mondayDate.getUTCFullYear()}-${pad(mondayDate.getUTCMonth() + 1)}-${pad(mondayDate.getUTCDate())}T00:00:00+02:00`;
  // Setmana sencera = 7 dies; el final és el dilluns següent a les 00:00.
  const endIso = new Date(new Date(startIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const sundayDate = new Date(mondayDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { startIso, endIso, mondayDate, sundayDate };
}

type CategoryStandingsLite = {
  pair_id: string;
  category_id: string;
  group_id: string;
  matches_won: number;
  matches_lost: number;
  sets_diff: number;
  games_diff: number;
};

// Classificació actual per categoria/grup, amb el mateix criteri de
// desempat que /grups/[level] (victòries, diferència de sets, diferència de
// jocs i, finalment, enfrontament directe — §7 del reglament). Retorna null
// si encara no hi ha grups sortejats o cap categoria amb dades per mostrar.
async function buildStandingsSummaryText(
  supabase: ReturnType<typeof createServiceClient>,
  tournamentId: string,
): Promise<string | null> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca')
    .eq('tournament_id', tournamentId)
    .order('level');
  if (!categories || categories.length === 0) return null;

  const categoryIds = categories.map((c) => c.id);
  const { data: groups } = await supabase
    .from('groups')
    .select('id, label, category_id')
    .in('category_id', categoryIds)
    .order('label');
  if (!groups || groups.length === 0) return null;

  const { data: standings } = await supabase
    .from('category_standings')
    .select('pair_id, category_id, group_id, matches_won, matches_lost, sets_diff, games_diff')
    .in('category_id', categoryIds);

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id, group_id, category_id')
    .in('category_id', categoryIds)
    .not('group_id', 'is', null);

  const playerIds = Array.from(
    new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])),
  );
  const { data: players } = playerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', playerIds)
    : { data: [] };

  const { data: groupMatches } = await supabase
    .from('matches')
    .select('pair_a_id, pair_b_id, winner_pair_id, category_id')
    .in('category_id', categoryIds)
    .eq('phase', 'group')
    .in('status', ['validated', 'walkover']);

  const pairLabelOf = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    return lastNamesPairFromPlayers(players, pair.player_a_id, pair.player_b_id);
  };

  const sortGroupStandings = (rows: CategoryStandingsLite[]) =>
    [...rows].sort((a, b) => {
      if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
      if (a.sets_diff !== b.sets_diff) return b.sets_diff - a.sets_diff;
      if (a.games_diff !== b.games_diff) return b.games_diff - a.games_diff;
      const direct = (groupMatches ?? []).find(
        (m) =>
          m.winner_pair_id != null &&
          ((m.pair_a_id === a.pair_id && m.pair_b_id === b.pair_id) ||
            (m.pair_a_id === b.pair_id && m.pair_b_id === a.pair_id)),
      );
      if (direct?.winner_pair_id === a.pair_id) return -1;
      if (direct?.winner_pair_id === b.pair_id) return 1;
      return 0;
    });

  const blocks: string[] = [];
  for (const cat of categories) {
    const catGroups = groups.filter((g) => g.category_id === cat.id);
    const groupLines: string[] = [];
    for (const g of catGroups) {
      const groupStandings = sortGroupStandings(
        (standings ?? []).filter((s) => s.group_id === g.id),
      );
      if (groupStandings.length === 0) continue;
      const ranked = groupStandings
        .map(
          (s, idx) => `${idx + 1}. ${pairLabelOf(s.pair_id)} (${s.matches_won}-${s.matches_lost})`,
        )
        .join(' · ');
      groupLines.push(`Grup ${g.label}: ${ranked}`);
    }
    if (groupLines.length === 0) continue;
    blocks.push(`*${cat.name_ca}*\n${groupLines.join('\n')}`);
  }

  if (blocks.length === 0) return null;
  return `📊 *Classificació actual*\n\n${blocks.join('\n\n')}`;
}

// 8b) Resum setmanal → missatge al grup cada diumenge amb tots els partits de
//     la setmana següent sencera i la classificació actual de cada categoria
//     (a més del "Avui es juga" diari). Deixa d'enviar-se un cop acabada la
//     fase de grups (GROUP_PHASE_LAST_DAY): la classificació ja no canvia i
//     el calendari de l'eliminatòria el gestiona l'organització directament.
export async function notifyWeeklyScheduleToGroup(): Promise<void> {
  try {
    if (madridDateKey(new Date().toISOString()) > GROUP_PHASE_LAST_DAY) return;

    const supabase = createServiceClient();
    const { startIso, endIso, mondayDate, sundayDate } = nextWeekWindowIso();

    const { data: matches } = await supabase
      .from('matches')
      .select('id, scheduled_at, court_label, pair_a_id, pair_b_id, category_id, status')
      .in('status', ['scheduled', 'pending_validation'])
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true });

    if (!matches || matches.length === 0) {
      // Sense partits programats la setmana vinent: no enviem res.
      return;
    }

    const pairIds = Array.from(new Set(matches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', pairIds);

    const playerIds = Array.from(
      new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])),
    );
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);

    const categoryIds = Array.from(new Set(matches.map((m) => m.category_id)));
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name_ca')
      .in('id', categoryIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs?.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPairFromPlayers(players, pair.player_a_id, pair.player_b_id);
    };
    const categoryNameOf = (categoryId: string) =>
      categories?.find((c) => c.id === categoryId)?.name_ca ?? '—';

    const lines = matches.map((m) => {
      const day = weekdayCA(m.scheduled_at!);
      const time = formatMadridTime(m.scheduled_at);
      const court = m.court_label ?? '—';
      const cat = categoryNameOf(m.category_id);
      const labelA = pairLabelOf(m.pair_a_id);
      const labelB = pairLabelOf(m.pair_b_id);
      return `• ${day} ${time} · ${court} · ${cat} · ${labelA} vs ${labelB}`;
    });

    const rangeLabel = `${formatMadridDayMonth(mondayDate)} – ${formatMadridDayMonth(sundayDate)}`;

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('edition', 5)
      .maybeSingle();
    const standingsText = tournament
      ? await buildStandingsSummaryText(supabase, tournament.id)
      : null;

    const text =
      `📅 *Partits de la setmana (${rangeLabel})*\n\n${lines.join('\n')}\n\n` +
      (standingsText ? `${standingsText}\n\n` : '') +
      `🗓️ Calendari complet:\n${SITE_URL}/ca/calendari`;

    await sendWhatsAppToGroup(text);
  } catch (err) {
    console.warn('[whatsapp] notifyWeeklyScheduleToGroup failed', err);
  }
}

// Feina del cron setmanal (oficialment diumenge 19:00 Madrid), compartida amb
// el self-heal (lib/cron/self-heal.ts).
export async function runWeeklyScheduleCron(): Promise<{ ran: boolean }> {
  if (!whatsappConfigured()) return { ran: false };
  const ran = await claimDailyRun('weekly_schedule');
  if (ran) await notifyWeeklyScheduleToGroup();
  return { ran };
}

// 9) Sorteig de grups fet → WhatsApp a tots els capitans de la categoria.
export async function notifyDrawDoneWhatsApp(categoryId: string) {
  try {
    const supabase = createServiceClient();

    const { data: category } = await supabase
      .from('categories')
      .select('id, name_ca')
      .eq('id', categoryId)
      .maybeSingle();

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, captain_id, group_id')
      .eq('category_id', categoryId)
      .eq('status', 'confirmed')
      .not('group_id', 'is', null);
    if (!pairs || pairs.length === 0) return;

    const groupIds = Array.from(new Set(pairs.map((p) => p.group_id).filter(Boolean) as string[]));
    const { data: groups } = await supabase.from('groups').select('id, label').in('id', groupIds);
    const groupLabelById = new Map((groups ?? []).map((g) => [g.id, g.label]));

    const captainIds = Array.from(new Set(pairs.map((p) => p.captain_id)));
    const { data: captains } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .in('id', captainIds);
    const captainById = new Map((captains ?? []).map((c) => [c.id, c as Captain]));

    for (const pair of pairs) {
      const captain = captainById.get(pair.captain_id);
      if (!canWhatsApp(captain)) continue;
      const groupLabel = pair.group_id ? (groupLabelById.get(pair.group_id) ?? '—') : '—';
      const text =
        `🎲 *Sorteig fet!*\n` +
        `${category?.name_ca ?? ''} — has quedat al *grup ${groupLabel}*.\n\n` +
        `Veu els teus rivals i partits:\n${SITE_URL}/ca/captain/grup`;
      await sendWhatsApp({ to: captain!.phone, text });
    }

    // Avís també al grup del torneig amb el resum.
    const { data: level } = await supabase
      .from('categories')
      .select('level')
      .eq('id', categoryId)
      .maybeSingle();
    const standingsUrl = level?.level
      ? `${SITE_URL}/ca/grups/${level.level}`
      : `${SITE_URL}/ca/grups`;
    const groupText =
      `🎲 *Sorteig fet — ${category?.name_ca ?? ''}*\n` +
      `${pairs.length} parelles repartides en ${groupIds.length} grup${groupIds.length === 1 ? '' : 's'}.\n\n` +
      `Veu els grups i el calendari:\n${standingsUrl}`;
    await sendWhatsAppToGroup(groupText);
  } catch (err) {
    console.warn('[whatsapp] notifyDrawDone failed', err);
  }
}

// 9) Inscripció rebuda → WhatsApp al capità amb l'enllaç de pagament.
// És el complement del correu "Inscripció rebuda". S'envia just després de
// crear la parella i el `payments` pendent. La URL és la mateixa que la del
// correu (`/{locale}/p/{reference_code}`) i actua com a token d'accés.
export async function notifyInscriptionReceivedWhatsApp(params: {
  pairId: string;
  paymentReference: string;
  amountLabel: string;
  categoryLabel: string;
  locale: 'ca' | 'es';
}) {
  try {
    const supabase = createServiceClient();
    const { data: pair } = await supabase
      .from('pairs')
      .select('id, captain_id, player_a_id, player_b_id')
      .eq('id', params.pairId)
      .maybeSingle();
    if (!pair) return;

    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .in('id', [pair.captain_id, pair.player_a_id, pair.player_b_id]);

    const captain = (players ?? []).find((p) => p.id === pair.captain_id) as Captain | undefined;
    if (!canWhatsApp(captain)) return;

    const partnerId = pair.captain_id === pair.player_a_id ? pair.player_b_id : pair.player_a_id;
    const partner = (players ?? []).find((p) => p.id === partnerId);
    const paymentUrl = `${SITE_URL}/${params.locale}/p/${params.paymentReference}`;
    const partnerName = partner?.first_name ?? '';
    const greeting = captain!.first_name ? `Hola ${captain!.first_name}!` : 'Hola!';

    const text =
      `📝 *Inscripció rebuda — V Torneig Pàdel les Coves*\n` +
      `${greeting}\n` +
      `Has inscrit la parella amb *${partnerName}* a ${params.categoryLabel}.\n\n` +
      `💶 Import: *${params.amountLabel}*\n` +
      `Per completar la inscripció, fes el pagament aquí:\n${paymentUrl}\n\n` +
      `T'avisarem quan rebem el pagament.`;

    await sendWhatsApp({ to: captain!.phone, text });
  } catch (err) {
    console.warn('[whatsapp] notifyInscriptionReceived failed', err);
  }
}

// 10) Recordatori de validació → DM a ambdós capitans quan un partit ja hauria
//     d'estar jugat (>20h del scheduled_at) i el resultat no s'ha validat.
//     Cridat des del cron diari. Marca reminder_sent_at per evitar repeticions.
//     Finestra de 7 dies per no rescatar partits molt antics si el WA s'activa
//     tard o el cron ha fallat diverses vegades.
export async function sendValidationReminders(): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    const supabase = createServiceClient();
    const now = new Date();
    const cutoff20h = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: matches } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, scheduled_at')
      .in('status', ['scheduled', 'pending_validation'])
      .not('scheduled_at', 'is', null)
      .lt('scheduled_at', cutoff20h)
      .gte('scheduled_at', cutoff7d)
      .is('reminder_sent_at', null);

    if (!matches || matches.length === 0) return { sent: 0, skipped: 0 };

    for (const match of matches) {
      // Reclama el partit ABANS de fer res més: si dues invocacions
      // concurrents (p.ex. el self-heal disparat per diverses visites a la
      // vegada) hi arriben alhora, només una guanya la condició
      // `reminder_sent_at IS NULL` — evita enviar el mateix recordatori
      // diverses vegades.
      const { data: claimed } = await supabase
        .from('matches')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', match.id)
        .is('reminder_sent_at', null)
        .select('id');
      if (!claimed || claimed.length === 0) continue; // una altra invocació ja l'ha reclamat

      const { data: pairs } = await supabase
        .from('pairs')
        .select('id, captain_id, player_a_id, player_b_id')
        .in('id', [match.pair_a_id, match.pair_b_id]);
      if (!pairs || pairs.length < 2) {
        skipped++;
        continue;
      }

      const allPlayerIds = pairs.flatMap((p) => [p.captain_id, p.player_a_id, p.player_b_id]);
      const { data: players } = await supabase
        .from('players')
        .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
        .in('id', allPlayerIds);

      const pairLabelOf = (pairId: string) => {
        const pair = pairs.find((p) => p.id === pairId);
        if (!pair) return '—';
        return lastNamesPair(
          players?.find((p) => p.id === pair.player_a_id),
          players?.find((p) => p.id === pair.player_b_id),
        );
      };

      const labelA = pairLabelOf(match.pair_a_id);
      const labelB = pairLabelOf(match.pair_b_id);
      const dateText = formatDateCA(match.scheduled_at);

      // Si un dels dos capitans ja ha reportat el seu costat (partit en
      // pending_validation), el recordatori només l'ha de rebre l'altre —
      // el que encara falta per confirmar/reportar. Si cap dels dos ha
      // reportat (scheduled), el reben tots dos.
      const { data: reports } = await supabase
        .from('match_reports')
        .select('reporter_pair_side')
        .eq('match_id', match.id)
        .in('reporter_pair_side', ['a', 'b']);
      const reportedSides = new Set((reports ?? []).map((r) => r.reporter_pair_side));

      let atLeastOneSent = false;
      for (const pair of pairs) {
        const side = pair.id === match.pair_a_id ? 'a' : 'b';
        if (reportedSides.has(side)) continue; // aquest capità ja ha fet la seva part
        const captain = players?.find((p) => p.id === pair.captain_id) as Captain | undefined;
        if (!canWhatsApp(captain)) continue;
        const text =
          `⏰ *Recordatori: resultat pendent*\n` +
          `${labelA} vs ${labelB}\n` +
          `Jugat: ${dateText}\n\n` +
          `El resultat d'aquest partit encara no s'ha registrat i validat per ambdues parts. Fes-ho des de l'app:\n` +
          `${SITE_URL}/ca/captain/matches/${match.id}`;
        await sendWhatsApp({ to: captain.phone, text });
        atLeastOneSent = true;
      }

      if (atLeastOneSent) sent++;
      else skipped++;
    }
  } catch (err) {
    console.warn('[whatsapp] sendValidationReminders failed', err);
  }
  return { sent, skipped };
}

// 10b) Recordatori de proposta de canvi de data sense resposta → DM al capità
//      que ha de respondre quan la proposta porta >24h en 'pending'.
//      Cridat des del cron diari (08:00 Madrid). Marca reminder_sent_at per
//      no repetir-lo cada dia. Finestra de 7 dies pel mateix motiu que els
//      recordatoris de validació (no rescatar propostes antigues si el cron
//      ha estat aturat una temporada).
export async function sendRescheduleReminders(): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    const supabase = createServiceClient();
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: proposals } = await supabase
      .from('match_reschedule_proposals')
      .select('id, match_id, proposer_pair_side, new_scheduled_at, new_court_label, created_at')
      .eq('status', 'pending')
      .lt('created_at', cutoff24h)
      .gte('created_at', cutoff7d)
      .is('reminder_sent_at', null);

    if (!proposals || proposals.length === 0) return { sent: 0, skipped: 0 };

    for (const proposal of proposals) {
      // Reclama la proposta ABANS de fer res més: si dues invocacions
      // concurrents (p.ex. el self-heal disparat per diverses visites a la
      // vegada) hi arriben alhora, només una guanya la condició
      // `reminder_sent_at IS NULL` — evita enviar el mateix recordatori
      // diverses vegades.
      const { data: claimed } = await supabase
        .from('match_reschedule_proposals')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', proposal.id)
        .is('reminder_sent_at', null)
        .select('id');
      if (!claimed || claimed.length === 0) continue; // una altra invocació ja l'ha reclamat

      const { data: match } = await supabase
        .from('matches')
        .select('id, pair_a_id, pair_b_id, status')
        .eq('id', proposal.match_id)
        .maybeSingle();

      // Si el partit ja s'ha resolt mentre la proposta quedava penjada, no té
      // sentit recordar res.
      if (!match || match.status === 'validated' || match.status === 'walkover') {
        skipped++;
        continue;
      }

      const { data: pairs } = await supabase
        .from('pairs')
        .select('id, captain_id, player_a_id, player_b_id')
        .in('id', [match.pair_a_id, match.pair_b_id]);
      const playerIds = (pairs ?? []).flatMap((p) => [p.captain_id, p.player_a_id, p.player_b_id]);
      const { data: players } = playerIds.length
        ? await supabase
            .from('players')
            .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
            .in('id', playerIds)
        : { data: [] };

      const pairLabelOf = (pairId: string) => {
        const pair = pairs?.find((p) => p.id === pairId);
        if (!pair) return '—';
        return lastNamesPair(
          players?.find((p) => p.id === pair.player_a_id),
          players?.find((p) => p.id === pair.player_b_id),
        );
      };

      // Qui ha de respondre és el capità RIVAL del proposant.
      const rivalPairId = proposal.proposer_pair_side === 'a' ? match.pair_b_id : match.pair_a_id;
      const proposerPairId =
        proposal.proposer_pair_side === 'a' ? match.pair_a_id : match.pair_b_id;
      const rivalPair = pairs?.find((p) => p.id === rivalPairId);
      const rivalCaptain = players?.find((p) => p.id === rivalPair?.captain_id) as
        | Captain
        | undefined;

      if (canWhatsApp(rivalCaptain)) {
        const text =
          `⏰ *Recordatori: proposta de canvi pendent*\n` +
          `${pairLabelOf(proposerPairId)} et va proposar fa més d'un dia canviar el partit a:\n` +
          `📅 ${formatDateCA(proposal.new_scheduled_at)}` +
          (proposal.new_court_label ? `  ·  ${proposal.new_court_label}` : '') +
          `\n\nAccepta-la o rebutja-la perquè el partit no quedi penjat:\n` +
          `${SITE_URL}/ca/captain/matches/${proposal.match_id}/reschedule`;
        await sendWhatsApp({ to: rivalCaptain.phone, text });
        sent++;
      } else {
        skipped++;
      }
    }
  } catch (err) {
    console.warn('[whatsapp] sendRescheduleReminders failed', err);
  }
  return { sent, skipped };
}

// "Pany" d'idempotència: qui aconsegueix inserir la fila per (job, dia
// Madrid) és qui executa el job. Com que hi ha dos disparadors possibles pel
// mateix job (el cron real de Vercel i el self-heal via trànsit del lloc —
// vegeu lib/cron/self-heal.ts), això garanteix que el missatge només s'envia
// una vegada al dia encara que ambdós es disparin.
async function claimDailyRun(jobName: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const runDate = madridDateKey(new Date().toISOString());
    const { error } = await supabase
      .from('cron_daily_runs')
      .insert({ job_name: jobName, run_date: runDate });
    if (error) {
      if (error.code === '23505') return false; // ja reclamat avui
      console.warn('[cron] claimDailyRun failed', jobName, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[cron] claimDailyRun threw', jobName, err);
    return false;
  }
}

// Feina diària completa del cron "match-reminders" (oficialment 08:00
// Madrid). Compartida entre la ruta de cron real i el self-heal perquè mai
// se'n dupliqui la lògica.
export async function runDailyReminderCron(): Promise<{
  dailyBroadcastRan: boolean;
  reminders: { sent: number; skipped: number };
  rescheduleReminders: { sent: number; skipped: number };
}> {
  if (!whatsappConfigured()) {
    return {
      dailyBroadcastRan: false,
      reminders: { sent: 0, skipped: 0 },
      rescheduleReminders: { sent: 0, skipped: 0 },
    };
  }

  // El resum diari i l'avís de canvi de tram només tenen sentit un cop al
  // dia: es reclamen amb el pany. Els recordatoris de validació/canvi de data
  // ja són idempotents per si mateixos (reminder_sent_at per partit/proposta),
  // així que és segur —i desitjable— re-executar-los sempre que es cridi
  // aquesta funció, encara que sigui més d'un cop al dia.
  const dailyBroadcastRan = await claimDailyRun('daily_broadcast');
  if (dailyBroadcastRan) {
    await sendDailyGroupSummary();
    await notifyFeePhaseChangeToGroup();
  }

  const reminders = await sendValidationReminders();
  const rescheduleReminders = await sendRescheduleReminders();

  return { dailyBroadcastRan, reminders, rescheduleReminders };
}

// 11) Canvi de tram de preu → avís al grup quan falten <24h.
// El cron diari (08:00 Madrid) crida aquesta funció: si algun tram de tarifa
// comença dins de les pròximes 24 hores, avisa el grup que és l'últim dia al
// preu actual. Com que el cron corre cada 24h, el missatge s'envia exactament
// una vegada per tram.
export async function notifyFeePhaseChangeToGroup(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, registration_closes_at')
      .eq('edition', 5)
      .maybeSingle();
    if (!tournament) return;

    const now = new Date();
    // Finestra de mirada endavant. El cron corre cada dia a les 08:00 Madrid;
    // amb 24h, l'avís cau exactament al matí del dia en què canvia el preu
    // (p.ex. canvi a les 19:00 → avís el mateix dia a les 08:00, ~11h abans).
    // No es fa servir una finestra "exacta" perquè un cron diari mai coincideix
    // amb l'hora justa; 24h garanteix que el matí del dia del canvi sempre
    // l'atrapa, i la marca d'enviat evita repeticions.
    const WARNING_WINDOW_HOURS = 24;
    const windowEnd = new Date(now.getTime() + WARNING_WINDOW_HOURS * 60 * 60 * 1000);

    const { data: fees } = await supabase
      .from('tournament_fees')
      .select('id, label_ca, starts_at, ends_at, amount_per_player_cents, phase_change_warned_at')
      .eq('tournament_id', tournament.id)
      .order('starts_at', { ascending: true });
    if (!fees || fees.length === 0) return;

    // Tram que comença dins de la finestra i del qual encara NO s'ha avisat.
    const upcoming = fees.find((f) => {
      const start = new Date(f.starts_at).getTime();
      return !f.phase_change_warned_at && start > now.getTime() && start <= windowEnd.getTime();
    });
    if (!upcoming) return;

    // Tram actiu ara (per mostrar el preu actual).
    const current = fees.find(
      (f) =>
        new Date(f.starts_at).getTime() <= now.getTime() &&
        now.getTime() < new Date(f.ends_at).getTime(),
    );

    const eur = (cents: number) =>
      (cents / 100).toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' });

    // Moment exacte del canvi en hora de Madrid. El cron salta el matí del dia
    // del canvi, així que normalment és "avui a les HH:mm" (no "demà").
    const changeTime = formatMatchTime(upcoming.starts_at, 'ca');
    const isToday = madridDateKey(upcoming.starts_at) === madridDateKey(now.toISOString());
    const whenLabel = isToday ? `avui a les ${changeTime}` : `demà a les ${changeTime}`;

    // És l'últim tram (tipus "fora de termini")? Si ho és, el missatge ha
    // d'esmentar fins quan estaran obertes les inscripcions amb el recàrrec.
    const isLastTram = !fees.some(
      (f) => new Date(f.starts_at).getTime() > new Date(upcoming.starts_at).getTime(),
    );

    const currentLine = current
      ? `Fins ${whenLabel} encara pots inscriure't per *${eur(current.amount_per_player_cents)}/jugador* (${current.label_ca}).\n`
      : '';

    const text = isLastTram
      ? `⏰ *Últimes inscripcions en termini!*\n` +
        currentLine +
        `${whenLabel} les inscripcions passen a ser *fora de termini*: *${eur(upcoming.amount_per_player_cents)}/jugador* fins al *${formatMatchDateTimeLong(upcoming.ends_at, 'ca')}*.\n` +
        `_⚠️ Les inscripcions fora de termini queden subjectes a la decisió de l'organització segons si encaixen a la fase de grups._\n\n` +
        `Inscriu la teva parella ara:\n${SITE_URL}/ca/inscripcio`
      : `⏰ *Últim moment al preu actual!*\n` +
        currentLine +
        `${whenLabel} el preu puja a *${eur(upcoming.amount_per_player_cents)}/jugador* (${upcoming.label_ca}).\n\n` +
        `Inscriu la teva parella ara:\n${SITE_URL}/ca/inscripcio`;

    // Marca el tram com a avisat NOMÉS si el missatge s'ha enviat de debò.
    // Si el grup no està configurat (skipped) o l'API ha fallat, deixem la
    // marca a null perquè el cron del dia següent ho torni a intentar.
    const result = await sendWhatsAppToGroup(text);
    if (!result.ok || result.skipped) {
      console.warn('[whatsapp] fee phase warning NOT sent; will retry next cron', result);
      return;
    }

    await supabase
      .from('tournament_fees')
      .update({ phase_change_warned_at: new Date().toISOString() })
      .eq('id', upcoming.id);
  } catch (err) {
    console.warn('[whatsapp] notifyFeePhaseChangeToGroup failed', err);
  }
}
