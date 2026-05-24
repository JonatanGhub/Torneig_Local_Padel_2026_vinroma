/**
 * Avisos per WhatsApp (Evolution API), en paral·lel als emails.
 * Només s'envia a jugadors amb consent_whatsapp = true, telèfon i no anonimitzats.
 * Tots els errors es capturen: un fallo de WhatsApp mai bloqueja la mutació.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { sendWhatsApp } from './send';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://torneigpadelvinroma-v-2026.vercel.app'
).replace(/\/$/, '');

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
      `\nConfirma o rebutja aquí:\n${SITE_URL}/ca/captain/matches/${proposal.match_id}`;
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

// 4) Recordatori de partit → WhatsApp als dos capitans (cridat des del cron)
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
