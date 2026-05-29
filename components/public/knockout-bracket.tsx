import { cn } from '@/lib/utils';

export type BracketMatch = {
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

export type BracketSet = {
  match_id: string;
  set_number: number;
  games_a: number;
  games_b: number;
};

export type BracketLabels = {
  main: string;
  consolation: string;
  not_generated: string;
  walkover_win: string;
  walkover_loss: string;
  round_final: string;
  round_semifinals: string;
  round_quarterfinals: string;
  round_of_16: string;
  round_of_32: string;
  round_generic: (teams: number) => string;
};

type Props = {
  matches: BracketMatch[];
  sets: BracketSet[];
  pairLabel: (pairId: string) => string;
  /** Pair IDs to highlight (e.g. the captain's own pairs). */
  highlightPairIds?: Set<string>;
  locale: 'ca' | 'es';
  labels: BracketLabels;
};

export function KnockoutBracket({
  matches,
  sets,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
}: Props) {
  const koMatches = matches.filter(
    (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
  );

  if (koMatches.length === 0) {
    return <p className="text-muted-foreground text-sm">{labels.not_generated}</p>;
  }

  const setsByMatch = new Map<string, BracketSet[]>();
  for (const s of sets) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.set_number - b.set_number);

  const buildRounds = (prefix: string) => {
    const byRound = new Map<number, BracketMatch[]>();
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
    if (matchCount === 1) return labels.round_final;
    if (matchCount === 2) return labels.round_semifinals;
    if (matchCount === 4) return labels.round_quarterfinals;
    if (matchCount === 8) return labels.round_of_16;
    if (matchCount === 16) return labels.round_of_32;
    return labels.round_generic(matchCount * 2);
  };

  return (
    <div className="space-y-12">
      {mainRounds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{labels.main}</h2>
          <BracketColumns
            rounds={mainRounds}
            setsByMatch={setsByMatch}
            pairLabel={pairLabel}
            highlightPairIds={highlightPairIds}
            locale={locale}
            labels={labels}
            roundTitle={roundTitle}
          />
        </section>
      )}
      {consRounds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{labels.consolation}</h2>
          <BracketColumns
            rounds={consRounds}
            setsByMatch={setsByMatch}
            pairLabel={pairLabel}
            highlightPairIds={highlightPairIds}
            locale={locale}
            labels={labels}
            roundTitle={roundTitle}
          />
        </section>
      )}
    </div>
  );
}

function BracketColumns({
  rounds,
  setsByMatch,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
  roundTitle,
}: {
  rounds: { round: number; list: BracketMatch[] }[];
  setsByMatch: Map<string, BracketSet[]>;
  pairLabel: (id: string) => string;
  highlightPairIds?: Set<string>;
  locale: 'ca' | 'es';
  labels: BracketLabels;
  roundTitle: (matchCount: number) => string;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {rounds.map((r) => (
          <div key={r.round} className="flex w-56 flex-col gap-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {roundTitle(r.list.length)}
            </h3>
            <div className="flex h-full flex-col justify-around gap-4">
              {r.list.map((m) => (
                <MatchBox
                  key={m.id}
                  match={m}
                  sets={setsByMatch.get(m.id) ?? []}
                  pairLabel={pairLabel}
                  highlightPairIds={highlightPairIds}
                  locale={locale}
                  labels={labels}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchBox({
  match,
  sets,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
}: {
  match: BracketMatch;
  sets: BracketSet[];
  pairLabel: (id: string) => string;
  highlightPairIds?: Set<string>;
  locale: 'ca' | 'es';
  labels: BracketLabels;
}) {
  const involvesHighlight =
    !!highlightPairIds &&
    (highlightPairIds.has(match.pair_a_id) || highlightPairIds.has(match.pair_b_id));

  return (
    <div
      className={cn(
        'border-border bg-background rounded-md border p-3 text-sm',
        involvesHighlight && 'ring-crimson-500/30 border-crimson-500/30 ring-2',
      )}
    >
      <PairRow
        match={match}
        side="a"
        sets={sets}
        pairLabel={pairLabel}
        labels={labels}
        isHighlight={!!highlightPairIds?.has(match.pair_a_id)}
      />
      <div className="border-border my-1.5 border-t" />
      <PairRow
        match={match}
        side="b"
        sets={sets}
        pairLabel={pairLabel}
        labels={labels}
        isHighlight={!!highlightPairIds?.has(match.pair_b_id)}
      />
      {match.status === 'scheduled' && match.scheduled_at && (
        <p className="text-muted-foreground mt-2 text-[0.7rem]">
          {new Date(match.scheduled_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Europe/Madrid',
          })}
          {match.court_label ? ` · ${match.court_label}` : ''}
        </p>
      )}
    </div>
  );
}

function PairRow({
  match,
  side,
  sets,
  pairLabel,
  labels,
  isHighlight,
}: {
  match: BracketMatch;
  side: 'a' | 'b';
  sets: BracketSet[];
  pairLabel: (id: string) => string;
  labels: BracketLabels;
  isHighlight: boolean;
}) {
  const pairId = side === 'a' ? match.pair_a_id : match.pair_b_id;
  const isWinner = match.winner_pair_id === pairId;
  const decided = match.status === 'validated' || match.status === 'walkover';
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        isWinner ? 'font-semibold' : decided ? 'text-muted-foreground' : '',
        isHighlight && 'text-crimson-600 dark:text-crimson-300',
      )}
    >
      <span className="truncate">{pairLabel(pairId)}</span>
      <span className="flex shrink-0 gap-1 font-mono text-xs">
        {match.status === 'walkover'
          ? isWinner
            ? labels.walkover_win
            : labels.walkover_loss
          : sets.map((s) => <span key={s.set_number}>{side === 'a' ? s.games_a : s.games_b}</span>)}
      </span>
    </div>
  );
}

export function defaultBracketLabels(
  t: (key: string, values?: Record<string, string | number>) => string,
): BracketLabels {
  return {
    main: t('bracket.main'),
    consolation: t('bracket.consolation'),
    not_generated: t('bracket.not_generated'),
    walkover_win: t('bracket.walkover_win'),
    walkover_loss: t('bracket.walkover_loss'),
    round_final: t('bracket.round_final'),
    round_semifinals: t('bracket.round_semifinals'),
    round_quarterfinals: t('bracket.round_quarterfinals'),
    round_of_16: t('bracket.round_of_16'),
    round_of_32: t('bracket.round_of_32'),
    round_generic: (teams: number) => t('bracket.round_generic', { teams }),
  };
}
