/**
 * Avisos per WhatsApp (Evolution API), en paral·lel als emails.
 * Només s'envia a jugadors amb consent_whatsapp = true, telèfon i no anonimitzats.
 * Tots els errors es capturen: un fallo de WhatsApp mai bloqueja la mutació.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getSiteUrl } from '@/lib/site-url';
import { sendWhatsApp, sendWhatsAppToGroup } from './send';

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
  a?: { last_name: string | null } | null,
  b?: { last_name: string | null } | null,
): string {
  return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
}

function formatDateCA(iso: string | null): string {
  if (!iso) return 'sense data';
  try {
    return new Date(iso).toLocaleString('ca-ES', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// 1) Resultat validat → WhatsApp als dos capitans
export async function notifyMatchValidatedWhatsApp(matchId: string) {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status, winner_pair_id')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.status !== 'validated') return;

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

    const { data: sets } = await supabase
      .from('sets')
      .select('set_number, games_a, games_b')
      .eq('match_id', matchId)
      .order('set_number', { ascending: true });
    const scoreText = (sets ?? []).map((s) => `${s.games_a}-${s.games_b}`).join(', ') || '—';

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
      const text =
        `🎾 *Resultat validat*\n` +
        `${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}\n` +
        `Marcador: ${scoreText}\n` +
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
      .select('id, pair_a_id, pair_b_id')
      .eq('id', proposal.match_id)
      .maybeSingle();
    if (!match) return;

    const rivalPairId = proposal.proposer_pair_side === 'a' ? match.pair_b_id : match.pair_a_id;
    const { data: rivalPair } = await supabase
      .from('pairs')
      .select('id, captain_id')
      .eq('id', rivalPairId)
      .maybeSingle();
    if (!rivalPair) return;

    const { data: rivalCaptain } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone, consent_whatsapp, is_anonymized')
      .eq('id', rivalPair.captain_id)
      .maybeSingle();
    if (!canWhatsApp(rivalCaptain as Captain | null)) return;

    const text =
      `📅 *Proposta de canvi de partit*\n` +
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
      .select('id, last_name')
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
    if (!rivalPair) return;
    const rivalCaptain = players?.find((p) => p.id === rivalPair.captain_id) as Captain | undefined;
    if (!canWhatsApp(rivalCaptain)) return;

    const { data: report } = await supabase
      .from('match_reports')
      .select('score_json')
      .eq('match_id', matchId)
      .eq('reporter_pair_side', reporterSide)
      .maybeSingle();
    const scoreText = Array.isArray(report?.score_json)
      ? (report!.score_json as { a: number; b: number }[]).map((s) => `${s.a}-${s.b}`).join(', ')
      : '—';

    const text =
      `📝 *Resultat per confirmar*\n` +
      `${pairLabelOf(reporterPairId)} ha reportat: ${scoreText}\n` +
      `vs ${pairLabelOf(rivalPairId)}\n\n` +
      `Confirma'l (o reporta el teu) a l'app perquè quedi validat:\n` +
      `${SITE_URL}/ca/captain/matches/${matchId}`;
    await sendWhatsApp({ to: rivalCaptain!.phone, text });
  } catch (err) {
    console.warn('[whatsapp] notifyResultPendingValidation failed', err);
  }
}

// 5) Recordatori de partit → WhatsApp als dos capitans (cridat des del cron)
export async function notifyMatchReminderWhatsApp(matchId: string) {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, scheduled_at, court_label')
      .eq('id', matchId)
      .maybeSingle();
    if (!match) return;

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
        `⏰ *Recordatori de partit*\n` +
        `${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}\n` +
        `🗓️ ${formatDateCA(match.scheduled_at)}\n` +
        (match.court_label ? `📍 Pista: ${match.court_label}\n` : '') +
        `\nBona sort! ${SITE_URL}/ca/captain`;
      await sendWhatsApp({ to: captain.phone, text });
    }
  } catch (err) {
    console.warn('[whatsapp] notifyMatchReminder failed', err);
  }
}

// =========================================================================
// Avisos al GRUP de gestió de WhatsApp (paral·lels als DMs als capitans).
// Tots passen per sendWhatsAppToGroup() que ja és no-op si WHATSAPP_GROUP_JID
// no està definit. Mai llancen.
// =========================================================================

type PlayerLite = { id: string; last_name: string | null };

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

// 6) Resultat validat → missatge al grup amb el marcador oficial.
export async function notifyValidatedToGroup(matchId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: match } = await supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status, winner_pair_id, category_id, group_label')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.status !== 'validated') return;

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', [match.pair_a_id, match.pair_b_id]);
    if (!pairs || pairs.length < 2) return;

    const playerIds = pairs.flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: players } = await supabase
      .from('players')
      .select('id, last_name')
      .in('id', playerIds);

    const { data: sets } = await supabase
      .from('sets')
      .select('set_number, games_a, games_b')
      .eq('match_id', matchId)
      .order('set_number', { ascending: true });
    const scoreText = (sets ?? []).map((s) => `${s.games_a}-${s.games_b}`).join(', ') || '—';

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

    const text =
      `✅ *Resultat oficial*\n` +
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
export async function notifyRescheduleAcceptedToGroup(proposalId: string): Promise<void> {
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
      .select('id, last_name')
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
  } catch (err) {
    console.warn('[whatsapp] notifyRescheduleAcceptedToGroup failed', err);
  }
}

// 8) Resum diari "Avui es juga" → missatge al grup amb tots els partits del dia.
//    Cridat des del cron diari (09:00 Madrid).
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

export async function sendDailyGroupSummary(): Promise<void> {
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
      // Sense partits avui: no enviem res per evitar soroll al grup.
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
      .select('id, last_name')
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
    const text =
      `🎾 *Avui es juga (${day})*\n\n${lines.join('\n')}\n\n` +
      `🗓️ Calendari complet:\n${SITE_URL}/ca/calendari\n` +
      `Bona sort!`;

    await sendWhatsAppToGroup(text);
  } catch (err) {
    console.warn('[whatsapp] sendDailyGroupSummary failed', err);
  }
}
