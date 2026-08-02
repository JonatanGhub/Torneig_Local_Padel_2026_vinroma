import { Clock } from 'lucide-react';
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

// Horari fix (knockout_final_week_schedule) per pintar dia/hora/pista a les
// rondes FUTURES que encara no existeixen com a partits (placeholders).
export type BracketScheduleSlot = {
  bracket: 'ko' | 'cons';
  round_number: number;
  position: number;
  match_date: string;
  match_time: string;
  court_label: string;
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
  /** Horari fix per a rondes futures (placeholders fins a la final). */
  schedule?: BracketScheduleSlot[];
};

// Un "nodo" del arbre: o bé un partit real, o bé un placeholder d'una ronda
// futura ("Guanyador semifinal 1") que encara no s'ha creat a la BD.
type RealNode = { kind: 'real'; match: BracketMatch };
// resolved=true quan el partit d'origen ja té guanyador: label és el NOM
// REAL de la parella que avança, no el genèric "Guanyador semifinal 1".
type PlaceholderFeeder = { label: string; resolved: boolean };
type PlaceholderNode = {
  kind: 'placeholder';
  position: number;
  feeders: [PlaceholderFeeder, PlaceholderFeeder];
  slot?: BracketScheduleSlot;
};
type Node = RealNode | PlaceholderNode;
type Round = { round: number; nodes: Node[] };

const WINNER_PREFIX: Record<'ca' | 'es', string> = { ca: 'Guanyador', es: 'Ganador' };
const PENDING_LABELS: Record<'ca' | 'es', string> = { ca: 'Per determinar', es: 'Por determinar' };

// Nom curt de la ronda per compondre "Guanyador semifinal 1" — depèn del
// nombre de partits de la ronda d'on ve el guanyador.
function roundShortName(matchCount: number, locale: 'ca' | 'es'): string {
  if (matchCount === 1) return locale === 'ca' ? 'final' : 'final';
  if (matchCount === 2) return locale === 'ca' ? 'semifinal' : 'semifinal';
  if (matchCount === 4) return locale === 'ca' ? 'quarts' : 'cuartos';
  return locale === 'ca' ? 'partit' : 'partido';
}

export function KnockoutBracket({
  matches,
  sets,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
  schedule,
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

  // Construeix les rondes reals i hi afegeix les futures com a placeholders,
  // fins a la final — així el quadre sempre es veu SENCER, escalant cap al
  // títol, encara que les rondes següents encara no s'hagin jugat/creat.
  const buildRounds = (prefix: 'ko_' | 'cons_'): Round[] => {
    const bracketKey = prefix === 'ko_' ? 'ko' : 'cons';
    const byRound = new Map<number, BracketMatch[]>();
    for (const m of koMatches) {
      if (!m.phase.startsWith(prefix)) continue;
      const round = Number.parseInt(m.phase.slice(prefix.length), 10);
      const list = byRound.get(round) ?? [];
      list.push(m);
      byRound.set(round, list);
    }
    const rounds: Round[] = Array.from(byRound.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        nodes: list
          .sort((x, y) => Number(x.group_label ?? 0) - Number(y.group_label ?? 0))
          .map((match) => ({ kind: 'real', match }) as Node),
      }));
    if (rounds.length === 0) return rounds;

    // Placeholders de les rondes que falten fins a la final (1 partit).
    // Si un partit d'origen JA té guanyador (però la ronda següent encara no
    // s'ha creat perquè falta l'altre partit), es mostra el nom real de la
    // parella que avança en lloc del genèric "Guanyador semifinal N".
    const feederFor = (node: Node | undefined, fallback: string): PlaceholderFeeder => {
      if (
        node?.kind === 'real' &&
        (node.match.status === 'validated' || node.match.status === 'walkover') &&
        node.match.winner_pair_id
      ) {
        return { label: pairLabel(node.match.winner_pair_id), resolved: true };
      }
      return { label: fallback, resolved: false };
    };

    let last = rounds[rounds.length - 1]!;
    while (last.nodes.length > 1) {
      const prevShort = roundShortName(last.nodes.length, locale);
      const nextRound = last.round + 1;
      const nodes: Node[] = [];
      for (let pos = 1; pos <= last.nodes.length / 2; pos++) {
        const slot = (schedule ?? []).find(
          (s) => s.bracket === bracketKey && s.round_number === nextRound && s.position === pos,
        );
        nodes.push({
          kind: 'placeholder',
          position: pos,
          feeders: [
            feederFor(last.nodes[2 * pos - 2], `${WINNER_PREFIX[locale]} ${prevShort} ${2 * pos - 1}`),
            feederFor(last.nodes[2 * pos - 1], `${WINNER_PREFIX[locale]} ${prevShort} ${2 * pos}`),
          ],
          slot,
        });
      }
      const next: Round = { round: nextRound, nodes };
      rounds.push(next);
      last = next;
    }
    return rounds;
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
          <BracketTree
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
          <BracketTree
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

// -------------------------------------------------------------------------
// L'arbre: columnes de rondes intercalades amb columnes de connectors. Cada
// caixa ocupa una fracció igual (flex-1) de l'alçada total de la columna, de
// manera que el centre d'un partit de la ronda N+1 queda exactament al mig
// dels seus dos partits d'origen — i els "colzes" dels connectors uneixen
// aquests centres amb línies de vora.
// -------------------------------------------------------------------------
function BracketTree({
  rounds,
  setsByMatch,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
  roundTitle,
}: {
  rounds: Round[];
  setsByMatch: Map<string, BracketSet[]>;
  pairLabel: (id: string) => string;
  highlightPairIds?: Set<string>;
  locale: 'ca' | 'es';
  labels: BracketLabels;
  roundTitle: (matchCount: number) => string;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Títols de ronda, alineats amb les columnes de sota. */}
        <div className="flex">
          {rounds.map((r, idx) => (
            <div key={r.round} className="flex">
              {idx > 0 && <div className="w-8" />}
              <div className="w-72">
                <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                  {roundTitle(r.nodes.length)}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-stretch">
          {rounds.map((r, idx) => (
            <div key={r.round} className="flex items-stretch">
              {/* Columna de connectors entre la ronda anterior i aquesta. */}
              {idx > 0 && (
                <div className="flex w-8 flex-col">
                  {r.nodes.map((_, j) => (
                    <div key={j} className="relative flex-1">
                      {/* Colze: baixa del centre del feeder superior (25%) al
                          centre del feeder inferior (75%) i entra al partit
                          d'aquesta ronda pel mig (50%). */}
                      <div className="border-border absolute top-[25%] bottom-[25%] left-0 w-1/2 rounded-r-sm border-y border-r" />
                      <div className="border-border absolute top-1/2 right-0 left-1/2 border-t" />
                    </div>
                  ))}
                </div>
              )}

              {/* Columna de partits (o placeholders). */}
              <div className="flex w-72 flex-col">
                {r.nodes.map((n, j) => (
                  <div key={j} className="flex flex-1 items-center py-1.5">
                    {n.kind === 'real' ? (
                      <MatchBox
                        match={n.match}
                        sets={setsByMatch.get(n.match.id) ?? []}
                        pairLabel={pairLabel}
                        highlightPairIds={highlightPairIds}
                        locale={locale}
                        labels={labels}
                        isFinal={r.nodes.length === 1}
                      />
                    ) : (
                      <PlaceholderBox node={n} locale={locale} isFinal={r.nodes.length === 1} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSlotDate(iso: string, locale: 'ca' | 'es'): string {
  return new Date(iso).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

function MatchBox({
  match,
  sets,
  pairLabel,
  highlightPairIds,
  locale,
  labels,
  isFinal,
}: {
  match: BracketMatch;
  sets: BracketSet[];
  pairLabel: (id: string) => string;
  highlightPairIds?: Set<string>;
  locale: 'ca' | 'es';
  labels: BracketLabels;
  isFinal: boolean;
}) {
  const involvesHighlight =
    !!highlightPairIds &&
    (highlightPairIds.has(match.pair_a_id) || highlightPairIds.has(match.pair_b_id));

  return (
    <div
      className={cn(
        'border-border bg-background w-full rounded-lg border p-3 text-sm shadow-sm',
        involvesHighlight && 'ring-crimson-500/30 border-crimson-500/30 ring-2',
        isFinal && 'border-amber-400/50 shadow-amber-400/10 shadow-md',
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
        <p className="text-muted-foreground mt-2 flex items-center gap-1 text-[0.7rem]">
          <Clock className="size-3 shrink-0" />
          {formatSlotDate(match.scheduled_at, locale)}
          {match.court_label ? ` · ${match.court_label}` : ''}
        </p>
      )}
    </div>
  );
}

function FeederLine({ feeder, locale }: { feeder: PlaceholderFeeder; locale: 'ca' | 'es' }) {
  // Nom real (parella ja classificada): estil normal. Genèric ("Guanyador
  // semifinal 1"): cursiva apagada.
  return feeder.resolved ? (
    <p className="text-foreground leading-tight font-medium break-words dark:text-white">
      {feeder.label}
    </p>
  ) : (
    <p
      className="text-muted-foreground leading-tight break-words italic"
      title={PENDING_LABELS[locale]}
    >
      {feeder.label}
    </p>
  );
}

function PlaceholderBox({
  node,
  locale,
  isFinal,
}: {
  node: PlaceholderNode;
  locale: 'ca' | 'es';
  isFinal: boolean;
}) {
  return (
    <div
      className={cn(
        'border-border w-full rounded-lg border border-dashed bg-transparent p-3 text-sm',
        isFinal && 'border-amber-400/40',
      )}
    >
      <FeederLine feeder={node.feeders[0]} locale={locale} />
      <div className="border-border my-1.5 border-t border-dashed" />
      <FeederLine feeder={node.feeders[1]} locale={locale} />
      {node.slot && (
        <p className="text-muted-foreground mt-2 flex items-center gap-1 text-[0.7rem]">
          <Clock className="size-3 shrink-0" />
          {formatSlotDate(
            `${node.slot.match_date}T${node.slot.match_time}:00+02:00`,
            locale,
          )}
          {` · ${node.slot.court_label}`}
        </p>
      )}
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
      {/* Sense truncate: els noms es parteixen en dues línies si cal, però
          es veuen SEMPRE sencers. */}
      <span className="min-w-0 flex-1 leading-tight break-words">{pairLabel(pairId)}</span>
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
