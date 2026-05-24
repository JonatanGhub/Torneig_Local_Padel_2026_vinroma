import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: Locale; level: string }> };

type KoMatch = {
  id: string;
  phase: string;
  group_label: string | null;
  pair_a_id: string;
  pair_b_id: string;
  status: string;
  winner_pair_id: string | null;
  scheduled_at: string | null;
  court_label: string | null;
};

type SetRow = { match_id: string; set_number: number; games_a: number; games_b: number };

export default async function BracketPage({ params }: Props) {
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

  const { data: allMatches } = await supabase
    .from('matches')
    .select(
      'id, phase, group_label, pair_a_id, pair_b_id, status, winner_pair_id, scheduled_at, court_label',
    )
    .eq('category_id', category.id);

  const koMatches = ((allMatches as KoMatch[] | null) ?? []).filter(
    (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
  );

  const pairIds = Array.from(new Set(koMatches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
  const { data: pairs } = pairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
    : { data: [] };

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase.from('public_player_names').select('id, last_name').in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);

  const matchIds = koMatches.map((m) => m.id);
  const { data: setsData } = matchIds.length
    ? await supabase
        .from('sets')
        .select('match_id, set_number, games_a, games_b')
        .in('match_id', matchIds)
    : { data: [] };
  const setsByMatch = new Map<string, SetRow[]>();
  for (const s of (setsData as SetRow[] | null) ?? []) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.set_number - b.set_number);

  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  const buildRounds = (prefix: string) => {
    const byRound = new Map<number, KoMatch[]>();
    for (const m of koMatches) {
      if (!m.phase.startsWith(prefix)) continue;
      const round = Number.parseInt(m.phase.slice(prefix.length), 10);
      const list = byRound.get(round) ?? [];
      list.push(m);
      byRound.set(round, list);
    }
    return Array.from(byRound.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        list: list.sort((x, y) => Number(x.group_label ?? 0) - Number(y.group_label ?? 0)),
      }));
  };

  const mainRounds = buildRounds('ko_');
  const consRounds = buildRounds('cons_');

  const roundTitle = (matchCount: number) => {
    if (matchCount === 1) return t('bracket.round_final');
    if (matchCount === 2) return t('bracket.round_semifinals');
    if (matchCount === 4) return t('bracket.round_quarterfinals');
    if (matchCount === 8) return t('bracket.round_of_16');
    if (matchCount === 16) return t('bracket.round_of_32');
    return t('bracket.round_generic', { teams: matchCount * 2 });
  };

  const PairRow = ({ match, side }: { match: KoMatch; side: 'a' | 'b' }) => {
    const pairId = side === 'a' ? match.pair_a_id : match.pair_b_id;
    const sets = setsByMatch.get(match.id) ?? [];
    const isWinner = match.winner_pair_id === pairId;
    const decided = match.status === 'validated' || match.status === 'walkover';
    return (
      <div
        className={`flex items-center justify-between gap-2 ${isWinner ? 'font-semibold' : decided ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate">{pairLabel(pairId)}</span>
        <span className="flex shrink-0 gap-1 font-mono text-xs">
          {match.status === 'walkover'
            ? isWinner
              ? t('bracket.walkover_win')
              : t('bracket.walkover_loss')
            : sets.map((s) => (
                <span key={s.set_number}>{side === 'a' ? s.games_a : s.games_b}</span>
              ))}
        </span>
      </div>
    );
  };

  const MatchCard = ({ match }: { match: KoMatch }) => (
    <div className="border-border bg-background rounded-md border p-3 text-sm">
      <PairRow match={match} side="a" />
      <div className="border-border my-1.5 border-t" />
      <PairRow match={match} side="b" />
      {match.status === 'scheduled' && match.scheduled_at && (
        <p className="text-muted-foreground mt-2 text-[0.7rem]">
          {new Date(match.scheduled_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
          {match.court_label ? ` · ${match.court_label}` : ''}
        </p>
      )}
    </div>
  );

  const BracketColumns = ({ rounds }: { rounds: { round: number; list: KoMatch[] }[] }) => (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {rounds.map((r) => (
          <div key={r.round} className="flex w-56 flex-col gap-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {roundTitle(r.list.length)}
            </h3>
            <div className="flex h-full flex-col justify-around gap-4">
              {r.list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
      <Link
        href={`/${locale}/quadre`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {locale === 'ca' ? category.name_ca : category.name_es}
      </h1>

      {koMatches.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('bracket.not_generated')}</p>
      )}

      {mainRounds.length > 0 && (
        <section className="mb-12 space-y-4">
          <h2 className="text-xl font-semibold">{t('bracket.main')}</h2>
          <BracketColumns rounds={mainRounds} />
        </section>
      )}

      {consRounds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t('bracket.consolation')}</h2>
          <BracketColumns rounds={consRounds} />
        </section>
      )}
    </main>
  );
}
