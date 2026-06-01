import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { formatMatchDateTime } from '@/lib/format-date';
import { ReschedulePanel } from '../reschedule-panel';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export default async function CaptainRescheduleMatchPage({ params }: Props) {
  const { locale, id: matchId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain/matches/${matchId}/reschedule`);

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

  // Si el partit ja està validat/walkover, no té sentit reprogramar.
  if (match.status === 'validated' || match.status === 'walkover') {
    redirect(`/${locale}/captain/matches/${matchId}`);
  }

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id, captain_id')
    .in('id', [match.pair_a_id, match.pair_b_id]);

  const myPair = (pairs ?? []).find((p) => p.captain_id === player.id);
  if (!myPair) redirect(`/${locale}/captain`);

  const mySide: 'a' | 'b' = myPair.id === match.pair_a_id ? 'a' : 'b';
  const rivalPair = (pairs ?? []).find((p) => p.id !== myPair.id);

  const allPlayerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  // Vista pública: la RLS de `players` només deixa el capità veure el seu
  // propi registre; `public_player_names` exposa id+last_name a tothom per a
  // les etiquetes de parella.
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

  const { data: proposals } = await supabase
    .from('match_reschedule_proposals')
    .select(
      'id, proposer_pair_side, new_scheduled_at, new_court_label, message, status, created_at',
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });
  const pendingProposal = proposals?.find((p) => p.status === 'pending') ?? null;
  const historyProposals = (proposals ?? []).filter((p) => p.status !== 'pending');

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
            ? formatMatchDateTime(match.scheduled_at, locale)
            : t('captain.not_scheduled')}{' '}
          · {match.court_label ?? '—'}
        </p>
      </header>

      <ReschedulePanel
        locale={locale}
        matchId={match.id}
        mySide={mySide}
        pending={pendingProposal}
        history={historyProposals}
      />
    </main>
  );
}
