import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    // No es capitán de ninguna pareja en este partido.
    redirect(`/${locale}/captain`);
  }

  const mySide: 'a' | 'b' = myPair.id === match.pair_a_id ? 'a' : 'b';
  const rivalPair = (pairs ?? []).find((p) => p.id !== myPair.id);

  const allPlayerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = allPlayerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', allPlayerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  // Reports existentes
  const { data: reports } = await supabase
    .from('match_reports')
    .select('id, reporter_player_id, reporter_pair_side, score_json, reported_at')
    .eq('match_id', matchId)
    .order('reported_at', { ascending: false });

  const myReport = reports?.find((r) => r.reporter_pair_side === mySide) ?? null;
  const rivalReport =
    reports?.find((r) => r.reporter_pair_side !== mySide && r.reporter_pair_side !== 'admin') ??
    null;

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

      <ReportForm
        matchId={match.id}
        defaultScore={myReport?.score_json ?? rivalReport?.score_json ?? null}
        readOnly={match.status === 'validated' || match.status === 'walkover'}
      />
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
