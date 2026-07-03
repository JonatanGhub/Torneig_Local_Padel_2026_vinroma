import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { getCaptainPlayerIds } from '@/lib/captain/data';
import { formatMatchDateTime, formatMatchDateTimeLong } from '@/lib/format-date';
import { ReportForm } from './report-form';
import { WalkoverReportButton } from './walkover-report-button';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export default async function CaptainMatchPage({ params }: Props) {
  const { locale, id: matchId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  // Les 3 consultes següents no depenen l'una de l'altra (cap necessita el
  // resultat de les altres), així que es disparen totes alhora.
  const [{ user, playerIds }, { data: match }, { data: reports }] = await Promise.all([
    getCaptainPlayerIds(),
    supabase
      .from('matches')
      .select('id, pair_a_id, pair_b_id, status, scheduled_at, court_label')
      .eq('id', matchId)
      .maybeSingle(),
    supabase
      .from('match_reports')
      .select('id, reporter_player_id, reporter_pair_side, score_json, reported_at')
      .eq('match_id', matchId)
      .order('reported_at', { ascending: false }),
  ]);
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain/matches/${matchId}`);
  if (playerIds.length === 0) redirect(`/${locale}/captain`);
  if (!match) notFound();

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id, captain_id')
    .in('id', [match.pair_a_id, match.pair_b_id]);

  const myPair = (pairs ?? []).find((p) => playerIds.includes(p.captain_id));
  if (!myPair) {
    redirect(`/${locale}/captain`);
  }

  const mySide: 'a' | 'b' = myPair.id === match.pair_a_id ? 'a' : 'b';
  const rivalPair = (pairs ?? []).find((p) => p.id !== myPair.id);

  const allPlayerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  // Cal `public_player_names` (vista pública amb només id+last_name) perquè la
  // RLS de `players` només deixa el capità llegir el seu propi registre, no el
  // del company ni el dels rivals. Si féssim servir `from('players')`, els
  // noms sortirien tots com a "—".
  const { data: players } = allPlayerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', allPlayerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${fullName(a)} / ${fullName(b)}`;
  };

  const myReport = reports?.find((r) => r.reporter_pair_side === mySide) ?? null;
  const rivalReport =
    reports?.find((r) => r.reporter_pair_side !== mySide && r.reporter_pair_side !== 'admin') ??
    null;

  // El marcador es desa relatiu a QUI reporta ("a"=el seu propi equip,
  // "b"=el rival), no en termes absoluts pair_a/pair_b. El report del rival,
  // per tant, té "a"/"b" CAPGIRATS respecte al meu punt de vista — si el
  // mostréssim tal qual sota les etiquetes "Nosaltres"/"Rivals" (com passava
  // abans), un capità podria confirmar sense adonar-se'n el marcador
  // exactament invertit del real, atorgant la victòria a qui ha perdut.
  // Això és EXACTAMENT el que va passar el 2/7 (partit Jordi/Mariano vs
  // Ainoa/Agnés): Jordi va confirmar el pre-emplenat sense capgirar-lo i el
  // sistema va validar el guanyador equivocat.
  const rivalReportFlipped = rivalReport ? flipScore(rivalReport.score_json) : null;

  // El resultat només es pot pujar si el partit ja s'ha jugat: la data de
  // programació ha de ser al passat. Si no hi ha data, encara no es pot.
  // Excepció: si el partit ja està pending_validation/disputed/validated, ja hi
  // ha algun report registrat — sempre cal poder accedir-hi per veure'l.
  const now = Date.now();
  const isPlayed = match.scheduled_at ? new Date(match.scheduled_at).getTime() <= now : false;
  const hasReportHistory =
    match.status === 'pending_validation' ||
    match.status === 'disputed' ||
    match.status === 'validated' ||
    match.status === 'walkover';
  const canReport = isPlayed || hasReportHistory;

  return (
    // pb-28: el botó flotant "Reportar problema" tapava l'última opció de la
    // pàgina (el botó de walkover) en mòbil.
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-8 pb-28">
      <Link
        href={`/${locale}/captain`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {pairLabel(myPair.id)} <span className="text-muted-foreground">vs</span>{' '}
          {pairLabel(rivalPair?.id ?? '')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {match.scheduled_at
            ? formatMatchDateTime(match.scheduled_at, locale)
            : t('captain.not_scheduled')}{' '}
          · {match.court_label ?? '—'}
        </p>
      </header>

      {match.status === 'disputed' && (
        <p className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
          {t('captain.dispute_warning')}
        </p>
      )}

      {match.status === 'pending_validation' && rivalReport && !myReport && (
        <div className="mb-4 space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p>{t('captain.rival_reported', { score: scoreToText(rivalReportFlipped) })}</p>
          <p className="text-xs font-medium">{t('captain.rival_reported_warning')}</p>
        </div>
      )}

      {canReport ? (
        <div className="space-y-3">
          <ReportForm
            matchId={match.id}
            defaultScore={myReport?.score_json ?? rivalReportFlipped}
            readOnly={match.status === 'validated' || match.status === 'walkover'}
          />
          {match.status !== 'validated' && match.status !== 'walkover' && (
            <WalkoverReportButton matchId={match.id} />
          )}
        </div>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t('captain.cannot_report_yet_title')}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {match.scheduled_at
                  ? t('captain.cannot_report_yet_body_scheduled', {
                      date: formatMatchDateTimeLong(match.scheduled_at, locale),
                    })
                  : t('captain.cannot_report_yet_body_unscheduled')}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Capgira els camps a/b de cada set d'un marcador. Cal per mostrar el report
// del RIVAL des del meu propi punt de vista: el rival el va desar amb
// "a"=el seu equip, "b"=el meu — jo necessito veure-ho a l'inrevés.
function flipScore(score: unknown): { set: number; a: number; b: number }[] | null {
  if (!Array.isArray(score)) return null;
  return score
    .filter(
      (s): s is { set: number; a: number; b: number } =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as { set: unknown }).set === 'number' &&
        typeof (s as { a: unknown }).a === 'number' &&
        typeof (s as { b: unknown }).b === 'number',
    )
    .map((s) => ({ set: s.set, a: s.b, b: s.a }));
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
