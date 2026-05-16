import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: Locale }> };

export default async function CaptainHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain`);

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!player) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
        <h1 className="text-2xl font-semibold">{t('captain.no_profile_title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('captain.no_profile_body')}</p>
      </main>
    );
  }

  const { data: myPairs } = await supabase
    .from('pairs')
    .select('id, status, category_id, group_id, player_a_id, player_b_id, captain_id')
    .eq('captain_id', player.id);

  const myPairIds = (myPairs ?? []).map((p) => p.id);

  const { data: matches } = myPairIds.length
    ? await supabase
        .from('matches')
        .select(
          'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id',
        )
        .or(myPairIds.map((id) => `pair_a_id.eq.${id},pair_b_id.eq.${id}`).join(','))
        .order('scheduled_at', { ascending: true, nullsFirst: true })
    : { data: [] };

  const categoriesData = await supabase.from('categories').select('id, name_ca, name_es');
  const categoryLabel = new Map(
    (categoriesData.data ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  // Pairs de los rivales
  const rivalPairIds = (matches ?? []).flatMap((m) =>
    myPairIds.includes(m.pair_a_id) ? [m.pair_b_id] : [m.pair_a_id],
  );
  const { data: rivals } = rivalPairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', rivalPairIds)
    : { data: [] };

  const allPlayerIds = (rivals ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = allPlayerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', allPlayerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = rivals?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('captain.greeting', { name: player.first_name ?? '' })}
        </h1>
        <p className="text-muted-foreground text-sm">{t('captain.subtitle')}</p>
      </header>

      {!matches || matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('captain.no_matches')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {matches.map((m) => {
            const rivalPairId = myPairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id;
            const myPairId = myPairIds.includes(m.pair_a_id) ? m.pair_a_id : m.pair_b_id;
            const youWon = m.winner_pair_id === myPairId;
            const hasResult = m.status === 'validated' || m.status === 'walkover';

            return (
              <li
                key={m.id}
                className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {t('captain.vs')} {pairLabel(rivalPairId)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {categoryLabel.get(m.category_id) ?? ''}{' '}
                    {m.group_label ? `· Grup ${m.group_label}` : ''} ·{' '}
                    {m.scheduled_at
                      ? new Date(m.scheduled_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES')
                      : t('captain.not_scheduled')}{' '}
                    · {m.court_label ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {hasResult ? (
                    <span
                      className={youWon ? 'font-medium text-green-600' : 'text-muted-foreground'}
                    >
                      {youWon ? t('captain.you_won') : t('captain.you_lost')}
                    </span>
                  ) : (
                    <Link
                      href={`/${locale}/captain/matches/${m.id}`}
                      className="rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-xs text-[hsl(var(--primary-foreground))]"
                    >
                      {m.status === 'pending_validation'
                        ? t('captain.review_result')
                        : m.status === 'disputed'
                          ? t('captain.disputed')
                          : t('captain.report_result')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
