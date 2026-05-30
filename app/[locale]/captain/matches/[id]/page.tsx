import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { ReportForm } from './report-form';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export default async function CaptainMatchPage({ params }: Props) {
  const { locale, id: matchId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain/matches/${matchId}`);

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!player) redirect(`/${locale}/captain`);

  const { data: match } = await supabase
    .from('matches')
    .select('id, pair_a_id, pair_b_id, status, scheduled_at, court_label')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) notFound();

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id, captain_id')
    .in('id', [match.pair_a_id, match.pair_b_id]);

  const myPair = (pairs ?? []).find((p) => p.captain_id === player.id);
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
    ? await supabase.from('public_player_names').select('id, last_name').in('id', allPlayerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  const { data: reports } = await supabase
    .from('match_reports')
    .select('id, reporter_player_id, reporter_pair_side, score_json, reported_at')
    .eq('match_id', matchId)
    .order('reported_at', { ascending: false });

  const myReport = reports?.find((r) => r.reporter_pair_side === mySide) ?? null;
  const rivalReport =
    reports?.find((r) => r.reporter_pair_side !== mySide && r.reporter_pair_side !== 'admin') ??
    null;

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
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
            ? new Date(match.scheduled_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES')
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
        <p className="mb-4 rounded-md bg-[hsl(var(--secondary))] p-3 text-sm">
          {t('captain.rival_reported', { score: scoreToText(rivalReport.score_json) })}
        </p>
      )}

      {canReport ? (
        <ReportForm
          matchId={match.id}
          defaultScore={myReport?.score_json ?? rivalReport?.score_json ?? null}
          readOnly={match.status === 'validated' || match.status === 'walkover'}
        />
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
                      date: new Date(match.scheduled_at).toLocaleString(
                        locale === 'ca' ? 'ca-ES' : 'es-ES',
                      ),
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
