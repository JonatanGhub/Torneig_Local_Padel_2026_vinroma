import { Trophy } from 'lucide-react';
import type { Locale } from '@/i18n';
import { formatSeed, type BracketSeed, type ProjectionCard } from '@/lib/bracket-projection';
import type { BracketMatch } from '@/lib/bracket-engine';

type Props = {
  cards: ProjectionCard[];
  locale: Locale;
  pairLabel: (pairId: string) => string;
  highlightPairIds?: Set<string>;
  t: (key: string) => string;
};

function roundName(size: number, t: (k: string) => string): string {
  if (size >= 8) return t('landing.bracket_round_qf');
  if (size === 4) return t('landing.bracket_round_sf');
  return t('landing.bracket_round_final');
}

// Targetes de previsió d'eliminatòria (segons resultats/classificacions
// actuals) compartides entre la secció pública ("com quedaria el quadre") i
// el panell de capità (mentre el quadre real encara no s'ha generat).
export function BracketProjectionCards({ cards, locale, pairLabel, highlightPairIds, t }: Props) {
  const seedText = (seed: BracketSeed): string =>
    seed.kind === 'pair' ? pairLabel(seed.pair_id) : formatSeed(seed, locale);
  const isMine = (seed: BracketSeed): boolean =>
    seed.kind === 'pair' && !!highlightPairIds?.has(seed.pair_id);

  const renderMatch = (m: BracketMatch) => (
    <li
      key={`${m.phase}-${m.position}`}
      className="text-foreground/80 flex items-center gap-2 text-sm dark:text-white/80"
    >
      <span
        className={`flex-1 truncate text-right ${isMine(m.a) ? 'text-crimson-600 dark:text-crimson-300 font-semibold' : ''}`}
      >
        {seedText(m.a)}
      </span>
      <span className="text-muted-foreground text-xs dark:text-white/35">vs</span>
      <span
        className={`flex-1 truncate ${isMine(m.b) ? 'text-crimson-600 dark:text-crimson-300 font-semibold' : ''}`}
      >
        {seedText(m.b)}
      </span>
    </li>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <div key={card.id} className="glass-card flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-foreground flex items-center gap-2 text-lg font-semibold dark:text-white">
              <Trophy className="text-crimson-500 dark:text-crimson-300 size-4" />
              {card.name}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                card.bracket.groupPhaseFinished
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground dark:bg-white/10 dark:text-white/60'
              }`}
            >
              {card.bracket.groupPhaseFinished
                ? t('landing.bracket_final')
                : t('landing.bracket_provisional')}
            </span>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-xs tracking-wide uppercase dark:text-white/45">
              {t('landing.bracket_main')} · {roundName(card.bracket.main[0]?.round_size ?? 0, t)}
            </p>
            <ul className="space-y-1.5">{card.bracket.main.map(renderMatch)}</ul>
          </div>

          {card.bracket.consolation.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs tracking-wide uppercase dark:text-white/45">
                {t('landing.bracket_consolation')} ·{' '}
                {roundName(card.bracket.consolation[0]?.round_size ?? 0, t)}
              </p>
              <ul className="space-y-1.5">{card.bracket.consolation.map(renderMatch)}</ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
