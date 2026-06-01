/**
 * Notificaciones por email disparadas desde server actions.
 * Lectura de emails usa el service client (saltea RLS) para acceder a datos
 * del capitán rival / admin que el caller no podría leer normalmente.
 *
 * Todas las funciones swallowean errores y los logean: el envío de email
 * NUNCA debe bloquear la mutación principal (resultado, reschedule, etc.).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getSiteUrl } from '@/lib/site-url';
import { sendEmail } from './send';
import RescheduleProposed from './templates/reschedule-proposed';
import MatchValidated from './templates/match-validated';
import MatchDisputed from './templates/match-disputed';
import ResultPendingValidation from './templates/result-pending-validation';
import MatchScheduled from './templates/match-scheduled';
import PaymentReceived from './templates/payment-received';
import DrawDone from './templates/draw-done';
import { formatMatchDateTimeLong } from '@/lib/format-date';

const SITE_URL = getSiteUrl();

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'clubpadelvinroma@gmail.com';

type PlayerLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
};

function fullName(p: PlayerLite | null | undefined): string {
  if (!p) return '—';
  const first = p.first_name?.trim() ?? '';
  const last = p.last_name?.trim() ?? '';
  return [first, last].filter(Boolean).join(' ') || '—';
}

function lastNamesPair(a?: PlayerLite | null, b?: PlayerLite | null): string {
  return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
}

function scoreToText(score: unknown): string {
  if (!Array.isArray(score)) return '';
  return score
    .map((s) =>
      typeof s === 'object' && s !== null && 'a' in s && 'b' in s
        ? `${(s as { a: number }).a}-${(s as { b: number }).b}`
        : '',
    )
    .filter(Boolean)
    .join(', ');
}

function formatDateCA(iso: string | null): string {
  if (!iso) return 'sense data';
  try {
    return new Date(iso).toLocaleString('ca-ES', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// =========================================================================
// 1) Reschedule propuesto → email al CAPITÁN RIVAL
// =========================================================================
export async function notifyRescheduleProposed(proposalId: string) {
  try {
    const supabase = createServiceClient();

    const { data: proposal } = await supabase
      .from('match_reschedule_proposals')
      .select(
        'id, match_id, proposer_player_id, proposer_pair_side, new_scheduled_at, new_court_label, message',
      )
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
      .select('id, captain_id, player_a_id, player_b_id')
      .eq('id', rivalPairId)
      .maybeSingle();
    if (!rivalPair) return;

    const { data: rivalCaptain } = await supabase
      .from('players')
      .select('id, first_name, last_name, email')
      .eq('id', rivalPair.captain_id)
      .maybeSingle();
    if (!rivalCaptain?.email) return;

    // Etiqueta del proponente: usar apellidos de la pareja proponente
    const proposerPairId = proposal.proposer_pair_side === 'a' ? match.pair_a_id : match.pair_b_id;
    const { data: proposerPair } = await supabase
      .from('pairs')
      .select('player_a_id, player_b_id')
      .eq('id', proposerPairId)
      .maybeSingle();
    let proposerLabel = 'El rival';
    if (proposerPair) {
      const { data: players } = await supabase
        .from('players')
        .select('id, first_name, last_name, email')
        .in('id', [proposerPair.player_a_id, proposerPair.player_b_id]);
      proposerLabel = lastNamesPair(
        players?.find((p) => p.id === proposerPair.player_a_id),
        players?.find((p) => p.id === proposerPair.player_b_id),
      );
    }

    await sendEmail({
      to: rivalCaptain.email,
      subject: `Proposta de canvi de partit · ${proposerLabel}`,
      react: RescheduleProposed({
        rivalCaptainName: fullName(rivalCaptain),
        proposerLabel,
        newDateText: formatDateCA(proposal.new_scheduled_at),
        newCourtLabel: proposal.new_court_label,
        message: proposal.message,
        actionUrl: `${SITE_URL}/ca/captain/matches/${proposal.match_id}`,
      }),
    });
  } catch (err) {
    console.warn('[email] notifyRescheduleProposed failed', err);
  }
}

// =========================================================================
// 2) Match validated → email a ambos capitanes
// =========================================================================
export async function notifyMatchValidated(matchId: string) {
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
      .select('id, first_name, last_name, email')
      .in('id', allPlayerIds);

    // Sets para calcular score
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
      const captain = players?.find((p) => p.id === pair.captain_id);
      if (!captain?.email) continue;
      const won = match.winner_pair_id === pair.id;
      const rivalPairId = pair.id === match.pair_a_id ? match.pair_b_id : match.pair_a_id;
      await sendEmail({
        to: captain.email,
        subject: `Resultat validat · ${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}`,
        react: MatchValidated({
          recipientName: fullName(captain),
          pairLabel: pairLabelOf(pair.id),
          rivalLabel: pairLabelOf(rivalPairId),
          scoreText,
          won,
        }),
      });
    }
  } catch (err) {
    console.warn('[email] notifyMatchValidated failed', err);
  }
}

// =========================================================================
// 2b) Resultado reportado (pendiente de validar) → email al CAPITÁN RIVAL
//     (el que aún no ha reportado) para que lo confirme en la app.
// =========================================================================
export async function notifyResultPendingValidation(matchId: string, reporterSide: 'a' | 'b') {
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
      .select('id, first_name, last_name, email')
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
    const rivalCaptain = players?.find((p) => p.id === rivalPair.captain_id);
    if (!rivalCaptain?.email) return;

    const { data: report } = await supabase
      .from('match_reports')
      .select('score_json')
      .eq('match_id', matchId)
      .eq('reporter_pair_side', reporterSide)
      .maybeSingle();
    const scoreText = scoreToText(report?.score_json) || '—';

    await sendEmail({
      to: rivalCaptain.email,
      subject: `Resultat per confirmar · ${pairLabelOf(reporterPairId)} vs ${pairLabelOf(rivalPairId)}`,
      react: ResultPendingValidation({
        rivalCaptainName: fullName(rivalCaptain),
        reporterLabel: pairLabelOf(reporterPairId),
        rivalLabel: pairLabelOf(rivalPairId),
        scoreText,
        actionUrl: `${SITE_URL}/ca/captain/matches/${matchId}`,
      }),
    });
  } catch (err) {
    console.warn('[email] notifyResultPendingValidation failed', err);
  }
}

// =========================================================================
// 3) Match disputed → email a admin
// =========================================================================
export async function notifyMatchDisputed(matchId: string) {
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

    const { data: reports } = await supabase
      .from('match_reports')
      .select('reporter_pair_side, score_json, reported_at')
      .eq('match_id', matchId)
      .order('reported_at', { ascending: false });
    const reportA = reports?.find((r) => r.reporter_pair_side === 'a');
    const reportB = reports?.find((r) => r.reporter_pair_side === 'b');

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[Disputa] ${pairLabelOf(match.pair_a_id)} vs ${pairLabelOf(match.pair_b_id)}`,
      react: MatchDisputed({
        pairALabel: pairLabelOf(match.pair_a_id),
        pairBLabel: pairLabelOf(match.pair_b_id),
        scoreA: scoreToText(reportA?.score_json) || '—',
        scoreB: scoreToText(reportB?.score_json) || '—',
        resolveUrl: `${SITE_URL}/ca/admin/disputes`,
      }),
    });
  } catch (err) {
    console.warn('[email] notifyMatchDisputed failed', err);
  }
}

// =========================================================================
// 4) Partit programat/reprogramat per l'admin → email als dos capitans.
// =========================================================================
export async function notifyMatchScheduled(matchId: string, isChange: boolean) {
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
      .select('id, first_name, last_name, email')
      .in('id', allPlayerIds);

    const pairLabelOf = (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return '—';
      return lastNamesPair(
        players?.find((p) => p.id === pair.player_a_id),
        players?.find((p) => p.id === pair.player_b_id),
      );
    };

    const dateText = formatMatchDateTimeLong(match.scheduled_at, 'ca');
    for (const pair of pairs) {
      const captain = players?.find((p) => p.id === pair.captain_id);
      if (!captain?.email) continue;
      const rivalPairId = pair.id === match.pair_a_id ? match.pair_b_id : match.pair_a_id;
      await sendEmail({
        to: captain.email,
        subject: isChange
          ? `Canvi d'horari · ${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}`
          : `Nou partit programat · ${pairLabelOf(pair.id)} vs ${pairLabelOf(rivalPairId)}`,
        react: MatchScheduled({
          recipientName: fullName(captain),
          pairLabel: pairLabelOf(pair.id),
          rivalLabel: pairLabelOf(rivalPairId),
          dateText,
          courtLabel: match.court_label ?? '—',
          isChange,
          actionUrl: `${SITE_URL}/ca/captain/calendari`,
        }),
      });
    }
  } catch (err) {
    console.warn('[email] notifyMatchScheduled failed', err);
  }
}

// =========================================================================
// 5) Pagament conciliat per l'admin → email al capità de la parella.
// =========================================================================
export async function notifyPaymentReconciled(paymentId: string) {
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
      .select('id, captain_id, category_id')
      .eq('id', payment.pair_id)
      .maybeSingle();
    if (!pair) return;

    const { data: captain } = await supabase
      .from('players')
      .select('id, first_name, last_name, email')
      .eq('id', pair.captain_id)
      .maybeSingle();
    if (!captain?.email) return;

    const { data: category } = pair.category_id
      ? await supabase.from('categories').select('name_ca').eq('id', pair.category_id).maybeSingle()
      : { data: null };

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('draw_at')
      .eq('edition', 5)
      .maybeSingle();

    const amountLabel = new Intl.NumberFormat('ca-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format((payment.amount_cents ?? 0) / 100);

    await sendEmail({
      to: captain.email,
      subject: 'Pagament confirmat — V Torneig Pàdel les Coves',
      react: PaymentReceived({
        recipientName: fullName(captain),
        categoryLabel: category?.name_ca ?? '—',
        amountLabel,
        drawDateLabel: tournament?.draw_at
          ? formatMatchDateTimeLong(tournament.draw_at, 'ca')
          : 'per confirmar',
      }),
    });
  } catch (err) {
    console.warn('[email] notifyPaymentReconciled failed', err);
  }
}

// =========================================================================
// 6) Sorteig de grups fet → email a tots els capitans de la categoria.
// =========================================================================
export async function notifyDrawDone(categoryId: string) {
  try {
    const supabase = createServiceClient();

    const { data: category } = await supabase
      .from('categories')
      .select('id, name_ca')
      .eq('id', categoryId)
      .maybeSingle();

    const { data: pairs } = await supabase
      .from('pairs')
      .select('id, captain_id, group_id, player_a_id, player_b_id')
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
      .select('id, first_name, last_name, email')
      .in('id', captainIds);
    const captainById = new Map((captains ?? []).map((c) => [c.id, c]));

    for (const pair of pairs) {
      const captain = captainById.get(pair.captain_id);
      if (!captain?.email) continue;
      const groupLabel = pair.group_id ? (groupLabelById.get(pair.group_id) ?? '—') : '—';
      await sendEmail({
        to: captain.email,
        subject: `Sorteig fet · ${category?.name_ca ?? ''} (grup ${groupLabel})`,
        react: DrawDone({
          recipientName: fullName(captain),
          categoryLabel: category?.name_ca ?? '—',
          groupLabel,
          actionUrl: `${SITE_URL}/ca/captain/grup`,
        }),
      });
    }
  } catch (err) {
    console.warn('[email] notifyDrawDone failed', err);
  }
}
