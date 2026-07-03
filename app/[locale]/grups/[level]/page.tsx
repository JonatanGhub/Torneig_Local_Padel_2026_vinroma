import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { MatchCard } from '@/components/match/match-card';

type Props = { params: Promise<{ locale: Locale; level: string }> };

export default async function GroupPage({ params }: Props) {
  const { locale, level: levelParam } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const level = Number.parseInt(levelParam, 10);
  if (!Number.isFinite(level) || level < 1 || level > 4) notFound();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  if (!tournament) notFound();

  const { data: category } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es')
    .eq('tournament_id', tournament.id)
    .eq('level', level)
    .maybeSingle();
  if (!category) notFound();

  const categoryLabel = locale === 'ca' ? category.name_ca : category.name_es;

  // Aquestes 5 consultes només depenen de category.id: cap depèn del
  // resultat de les altres, així que es disparen totes alhora.
  const [
    { data: groups },
    { data: pairs },
    { data: standings },
    { data: matches },
    { data: koProbe },
  ] = await Promise.all([
    supabase.from('groups').select('id, label').eq('category_id', category.id).order('label'),
    supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id, group_id')
      .eq('category_id', category.id)
      .not('group_id', 'is', null),
    supabase.from('category_standings').select('*').eq('category_id', category.id),
    supabase
      .from('matches')
      .select(
        'id, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id, category_id, phase',
      )
      .eq('category_id', category.id)
      .eq('phase', 'group')
      .order('scheduled_at', { ascending: true, nullsFirst: true }),
    supabase.from('matches').select('phase').eq('category_id', category.id).neq('phase', 'group'),
  ]);

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);

  const hasBracket = (koProbe ?? []).some(
    (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
  );

  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${fullName(a)} / ${fullName(b)}`;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <Link
        href={`/${locale}/grups`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{categoryLabel}</h1>
        {hasBracket && (
          <Link
            href={`/${locale}/quadre/${category.level}`}
            className="border-border inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--accent))]"
          >
            <Trophy className="size-4" />
            {t('bracket.view_cta')}
          </Link>
        )}
      </div>

      {(!groups || groups.length === 0) && (
        <p className="text-muted-foreground text-sm">{t('groups.not_drawn')}</p>
      )}

      <div className="space-y-12">
        {(groups ?? []).map((g) => {
          const groupStandings = (standings ?? [])
            .filter((s) => s.group_id === g.id)
            .sort((a, b) => {
              if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
              if (a.sets_diff !== b.sets_diff) return b.sets_diff - a.sets_diff;
              if (a.games_diff !== b.games_diff) return b.games_diff - a.games_diff;
              // §7: head-to-head tiebreaker.
              const direct = (matches ?? []).find(
                (m) =>
                  (m.status === 'validated' || m.status === 'walkover') &&
                  m.winner_pair_id != null &&
                  ((m.pair_a_id === a.pair_id && m.pair_b_id === b.pair_id) ||
                    (m.pair_a_id === b.pair_id && m.pair_b_id === a.pair_id)),
              );
              if (direct?.winner_pair_id === a.pair_id) return -1;
              if (direct?.winner_pair_id === b.pair_id) return 1;
              return 0;
            });
          const groupMatches = (matches ?? []).filter((m) => m.group_label === g.label);

          return (
            <section key={g.id} className="space-y-5">
              <h2 className="text-xl font-semibold">
                {t('groups.group_label', { label: g.label })}
              </h2>

              <div className="border-border overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))]/40">
                    <tr className="text-xs tracking-wide text-[hsl(var(--muted-foreground))] uppercase">
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">{t('groups.pair')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('groups.played')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('groups.won')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('groups.sets_diff')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('groups.games_diff')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStandings.map((s, idx) => (
                      <tr
                        key={s.pair_id}
                        className={`border-t border-[hsl(var(--border))] ${
                          idx % 2 === 1 ? 'bg-[hsl(var(--muted))]/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-[hsl(var(--muted-foreground))]">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium">{pairLabel(s.pair_id)}</td>
                        <td className="px-4 py-3 text-right">{s.matches_played}</td>
                        <td className="px-4 py-3 text-right">{s.matches_won}</td>
                        <td className="px-4 py-3 text-right">
                          {s.sets_diff > 0 ? '+' : ''}
                          {s.sets_diff}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.games_diff > 0 ? '+' : ''}
                          {s.games_diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {groupMatches.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {groupMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      category={categoryLabel}
                      groupLabel={m.group_label}
                      phase="group"
                      pairALabel={pairLabel(m.pair_a_id)}
                      pairBLabel={pairLabel(m.pair_b_id)}
                      scheduledAt={m.scheduled_at}
                      courtLabel={m.court_label}
                      status={
                        m.status as
                          | 'scheduled'
                          | 'pending_validation'
                          | 'validated'
                          | 'disputed'
                          | 'walkover'
                      }
                      winnerLabel={
                        m.winner_pair_id === m.pair_a_id
                          ? 'a'
                          : m.winner_pair_id === m.pair_b_id
                            ? 'b'
                            : null
                      }
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
