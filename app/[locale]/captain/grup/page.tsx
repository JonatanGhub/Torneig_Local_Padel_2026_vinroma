import { Users } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { MatchCard, type MatchCardPhase } from '@/components/match/match-card';
import { loadCaptainContext } from '@/lib/captain/data';
import { NoProfilePanel } from '../no-profile-panel';
import { CaptainGroupTabs } from './group-tabs';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ pair?: string }>;
};

const PHASE_MAP: Record<string, MatchCardPhase> = {
  group: 'group',
  ko_16: 'r16',
  ko_8: 'qf',
  ko_4: 'sf',
  ko_2: 'final',
  cons_8: 'qf',
  cons_4: 'sf',
  cons_2: 'final',
};

export default async function CaptainGroupPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { pair: requestedPair } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ctx = await loadCaptainContext(locale);
  if (!ctx.player) return <NoProfilePanel locale={locale} />;

  const supabase = await createClient();
  const { myPairs, pairLabels, categoryLabels } = ctx;

  const pairsWithGroup = myPairs.filter(
    (p): p is typeof p & { group_id: string; category_id: string } =>
      !!p.group_id && !!p.category_id,
  );

  if (pairsWithGroup.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Header
          eyebrow={t('captain.tab_group')}
          title={t('captain.group_page_title')}
          subtitle={t('captain.group_page_subtitle')}
        />
        <EmptyState title={t('captain.group_empty_title')} body={t('captain.group_empty_body')} />
      </main>
    );
  }

  const groupIds = Array.from(new Set(pairsWithGroup.map((p) => p.group_id)));
  // Fetch all matches across the categories in question (group phase only).
  const categoryIdsInGroups = Array.from(new Set(pairsWithGroup.map((p) => p.category_id)));

  // Aquestes 3 consultes són independents entre si: es disparen totes alhora.
  const [{ data: groups }, { data: standings }, { data: allGroupMatches }] = await Promise.all([
    supabase.from('groups').select('id, label, category_id').in('id', groupIds),
    supabase.from('category_standings').select('*').in('group_id', groupIds),
    supabase
      .from('matches')
      .select(
        'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id',
      )
      .in('category_id', categoryIdsInGroups)
      .eq('phase', 'group')
      .order('scheduled_at', { ascending: true, nullsFirst: true }),
  ]);

  // Top up pair labels for any pair appearing in the group that the helper
  // hasn't already cached (defensive — the helper does this for group-mates
  // already, but matches may pull in extras).
  const allPairIdsInGroups = Array.from(
    new Set((allGroupMatches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id])),
  );
  const missing = allPairIdsInGroups.filter((id) => !pairLabels.has(id));
  if (missing.length) {
    const { data: extra } = await supabase
      .from('pairs')
      .select('id, player_a_id, player_b_id')
      .in('id', missing);
    const playerIds = (extra ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
    const { data: names } = playerIds.length
      ? await supabase
          .from('public_player_names')
          .select('id, first_name, last_name')
          .in('id', playerIds)
      : { data: [] };
    const nameMap = new Map((names ?? []).map((p) => [p.id, fullName(p)]));
    for (const p of extra ?? []) {
      pairLabels.set(
        p.id,
        `${nameMap.get(p.player_a_id) ?? '—'} / ${nameMap.get(p.player_b_id) ?? '—'}`,
      );
    }
  }

  const pairTabs = pairsWithGroup.map((p, idx) => ({
    id: p.id,
    label: t('captain.group_pair_tab', {
      index: idx + 1,
      category: categoryLabels.get(p.category_id) ?? '',
    }),
  }));

  const groupByPairId = new Map(pairsWithGroup.map((p) => [p.id, p.group_id]));

  const content: Record<string, React.ReactNode> = {};
  for (const p of pairsWithGroup) {
    const groupId = groupByPairId.get(p.id)!;
    const group = (groups ?? []).find((g) => g.id === groupId);
    if (!group) {
      content[p.id] = (
        <EmptyState title={t('captain.group_empty_title')} body={t('captain.group_empty_body')} />
      );
      continue;
    }

    const groupStandings = (standings ?? [])
      .filter((s) => s.group_id === groupId)
      .sort((a, b) => {
        if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
        if (a.sets_diff !== b.sets_diff) return b.sets_diff - a.sets_diff;
        if (a.games_diff !== b.games_diff) return b.games_diff - a.games_diff;
        return 0;
      });

    const groupMatches = (allGroupMatches ?? []).filter(
      (m) => m.category_id === group.category_id && m.group_label === group.label,
    );

    content[p.id] = (
      <div className="space-y-8">
        <section>
          <h2 className="font-display mb-3 text-xl font-semibold tracking-tight">
            {t('captain.group_standings_title', { label: group.label })}
          </h2>
          <StandingsTable
            standings={groupStandings.map((s, idx) => ({
              position: idx + 1,
              pairLabel: pairLabels.get(s.pair_id) ?? '—',
              isMine: s.pair_id === p.id,
              matches_played: s.matches_played,
              matches_won: s.matches_won,
              sets_diff: s.sets_diff,
              games_diff: s.games_diff,
            }))}
            t={t}
          />
        </section>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold tracking-tight">
            {t('captain.group_matches_title', { label: group.label })}
          </h2>
          {groupMatches.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
              {t('captain.group_no_matches')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {groupMatches.map((m) => {
                const mySide: 'a' | 'b' | null =
                  m.pair_a_id === p.id ? 'a' : m.pair_b_id === p.id ? 'b' : null;
                return (
                  <li key={m.id}>
                    <MatchCard
                      category={categoryLabels.get(m.category_id) ?? ''}
                      groupLabel={m.group_label}
                      phase={PHASE_MAP[m.phase] ?? null}
                      pairALabel={pairLabels.get(m.pair_a_id) ?? '—'}
                      pairBLabel={pairLabels.get(m.pair_b_id) ?? '—'}
                      scheduledAt={m.scheduled_at}
                      courtLabel={m.court_label}
                      status={m.status}
                      myPairSide={mySide}
                      winnerLabel={
                        m.winner_pair_id === m.pair_a_id
                          ? 'a'
                          : m.winner_pair_id === m.pair_b_id
                            ? 'b'
                            : null
                      }
                      locale={locale}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Header
        eyebrow={t('captain.tab_group')}
        title={t('captain.group_page_title')}
        subtitle={t('captain.group_page_subtitle')}
      />
      <CaptainGroupTabs
        pairs={pairTabs}
        initialPairId={
          requestedPair && pairTabs.some((p) => p.id === requestedPair) ? requestedPair : undefined
        }
      >
        {content}
      </CaptainGroupTabs>
    </main>
  );
}

function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">{eyebrow}</p>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-white/65">{subtitle}</p>
    </header>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
      <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
        <Users className="size-6" />
      </div>
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/55">{body}</p>
    </div>
  );
}

type StandingsRow = {
  position: number;
  pairLabel: string;
  isMine: boolean;
  matches_played: number;
  matches_won: number;
  sets_diff: number;
  games_diff: number;
};

function StandingsTable({
  standings,
  t,
}: {
  standings: StandingsRow[];
  t: (key: string) => string;
}) {
  if (standings.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
        {t('captain.group_no_standings')}
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
      {/* Mobile: stacked cards. */}
      <ul className="space-y-2 p-3 md:hidden">
        {standings.map((s) => (
          <li
            key={s.position}
            className={`rounded-xl border p-3 text-sm ${
              s.isMine ? 'border-crimson-500/50 bg-crimson-600/10' : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-white/55">#{s.position}</span>
              <span className={`font-semibold ${s.isMine ? 'text-crimson-300' : 'text-white'}`}>
                {s.pairLabel}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-white/65">
              <div>
                <p className="text-white/45 uppercase">{t('groups.played')}</p>
                <p className="font-mono text-white">{s.matches_played}</p>
              </div>
              <div>
                <p className="text-white/45 uppercase">{t('groups.won')}</p>
                <p className="font-mono text-white">{s.matches_won}</p>
              </div>
              <div>
                <p className="text-white/45 uppercase">{t('groups.sets_diff')}</p>
                <p className="font-mono text-white">
                  {s.sets_diff > 0 ? '+' : ''}
                  {s.sets_diff}
                </p>
              </div>
              <div>
                <p className="text-white/45 uppercase">{t('groups.games_diff')}</p>
                <p className="font-mono text-white">
                  {s.games_diff > 0 ? '+' : ''}
                  {s.games_diff}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: classic table. */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs tracking-wide text-white/45 uppercase">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t('groups.pair')}</th>
            <th className="px-4 py-3 text-right">{t('groups.played')}</th>
            <th className="px-4 py-3 text-right">{t('groups.won')}</th>
            <th className="px-4 py-3 text-right">{t('groups.sets_diff')}</th>
            <th className="px-4 py-3 text-right">{t('groups.games_diff')}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => (
            <tr
              key={s.position}
              className={`border-b border-white/5 last:border-b-0 ${
                s.isMine
                  ? 'bg-crimson-600/10'
                  : idx % 2 === 0
                    ? 'bg-white/[0.02]'
                    : 'bg-transparent'
              }`}
            >
              <td className="px-4 py-3 font-mono text-white/55">{s.position}</td>
              <td
                className={`px-4 py-3 ${s.isMine ? 'text-crimson-300 font-semibold' : 'text-white'}`}
              >
                {s.pairLabel}
              </td>
              <td className="px-4 py-3 text-right text-white/80">{s.matches_played}</td>
              <td className="px-4 py-3 text-right text-white/80">{s.matches_won}</td>
              <td className="px-4 py-3 text-right text-white/80">
                {s.sets_diff > 0 ? '+' : ''}
                {s.sets_diff}
              </td>
              <td className="px-4 py-3 text-right text-white/80">
                {s.games_diff > 0 ? '+' : ''}
                {s.games_diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
