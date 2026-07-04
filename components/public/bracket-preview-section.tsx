import { getTranslations } from 'next-intl/server';
import { Trophy } from 'lucide-react';
import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';
import { fullName } from '@/lib/player-name';
import {
  computeCategoryBracket,
  formatSeed,
  type StandingRow,
  type GroupMeta,
  type BracketSeed,
  type BracketMatch,
} from '@/lib/bracket-engine';

type Props = { locale: Locale };

const roundName = (
  size: number,
  t: (k: string) => string,
): string => {
  if (size >= 8) return t('landing.bracket_round_qf');
  if (size === 4) return t('landing.bracket_round_sf');
  return t('landing.bracket_round_final');
};

export async function BracketPreviewSection({ locale }: Props) {
  const supabase = createPublicClient();
  const t = await getTranslations();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return null;

  // Cap d'aquestes 5 consultes depèn del resultat de les altres (totes
  // necessiten com a molt tournament.id): es disparen totes alhora.
  const [
    { data: categories },
    { data: groups },
    { data: pairs },
    { data: standings },
    { data: groupMatches },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament.id)
      .order('level'),
    supabase.from('groups').select('id, category_id, label').eq('tournament_id', tournament.id),
    supabase
      .from('pairs')
      .select('id, category_id, group_id, player_a_id, player_b_id, status')
      .eq('tournament_id', tournament.id)
      .in('status', ['pending_payment', 'confirmed'])
      .not('group_id', 'is', null),
    supabase
      .from('category_standings')
      .select('pair_id, category_id, group_id, matches_played, matches_won, sets_diff, games_diff'),
    supabase
      .from('matches')
      .select('category_id, group_label, status')
      .eq('tournament_id', tournament.id)
      .eq('phase', 'group'),
  ]);

  // Sense grups sortejats no hi ha res a previsualitzar.
  if (!groups || groups.length === 0) return null;

  // Etiquetes de parella (nom complet).
  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: names } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  const nameById = new Map((names ?? []).map((p) => [p.id, p]));
  const pairLabelById = new Map(
    (pairs ?? []).map((p) => [
      p.id,
      `${fullName(nameById.get(p.player_a_id))} / ${fullName(nameById.get(p.player_b_id))}`,
    ]),
  );

  const labelByGroupId = new Map((groups ?? []).map((g) => [g.id, g.label]));

  const seedText = (seed: BracketSeed): string => {
    if (seed.kind === 'pair') return pairLabelById.get(seed.pair_id) ?? formatSeed(seed, locale);
    return formatSeed(seed, locale);
  };

  // Construeix el quadre previst per a cada categoria.
  const cards = (categories ?? [])
    .map((c) => {
      const catGroups = (groups ?? []).filter((g) => g.category_id === c.id);
      if (catGroups.length === 0) return null;

      const catPairs = (pairs ?? []).filter((p) => p.category_id === c.id);
      const sizeByLabel = new Map<string, number>();
      for (const p of catPairs) {
        const label = p.group_id ? labelByGroupId.get(p.group_id) : null;
        if (label) sizeByLabel.set(label, (sizeByLabel.get(label) ?? 0) + 1);
      }

      const closedByLabel = new Map<string, boolean>();
      for (const g of catGroups) closedByLabel.set(g.label, true);
      for (const m of groupMatches ?? []) {
        if (m.category_id !== c.id) continue;
        if (m.status !== 'validated' && m.status !== 'walkover' && m.group_label) {
          closedByLabel.set(m.group_label, false);
        }
      }

      const groupMeta: GroupMeta[] = catGroups.map((g) => ({
        label: g.label,
        size: sizeByLabel.get(g.label) ?? 0,
        closed: closedByLabel.get(g.label) ?? false,
      }));

      const catStandings: StandingRow[] = (standings ?? [])
        .filter((s) => s.category_id === c.id)
        .map((s) => ({
          pair_id: s.pair_id,
          group_label: (s.group_id ? labelByGroupId.get(s.group_id) : '') ?? '',
          matches_played: Number(s.matches_played ?? 0),
          matches_won: Number(s.matches_won ?? 0),
          sets_diff: Number(s.sets_diff ?? 0),
          games_diff: Number(s.games_diff ?? 0),
        }))
        .filter((s) => s.group_label);

      const bracket = computeCategoryBracket(c.level, catStandings, groupMeta);
      if (!bracket.feasible || bracket.main.length === 0) return null;

      return {
        id: c.id,
        level: c.level,
        name: locale === 'ca' ? c.name_ca : c.name_es,
        bracket,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (cards.length === 0) return null;

  const renderMatch = (m: BracketMatch) => (
    <li
      key={`${m.phase}-${m.position}`}
      className="flex items-center gap-2 text-sm text-foreground/80 dark:text-white/80"
    >
      <span className="flex-1 truncate text-right">{seedText(m.a)}</span>
      <span className="text-xs text-muted-foreground dark:text-white/35">vs</span>
      <span className="flex-1 truncate">{seedText(m.b)}</span>
    </li>
  );

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
            {t('landing.bracket_eyebrow')}
          </p>
          <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {t('landing.bracket_title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground dark:text-white/55">
            {t('landing.bracket_subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="glass-card flex flex-col gap-4 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display flex items-center gap-2 text-lg font-semibold text-foreground dark:text-white">
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
              <p className="mb-1.5 text-xs tracking-wide text-muted-foreground dark:text-white/45 uppercase">
                {t('landing.bracket_main')} ·{' '}
                {roundName(card.bracket.main[0]?.round_size ?? 0, t)}
              </p>
              <ul className="space-y-1.5">{card.bracket.main.map(renderMatch)}</ul>
            </div>

            {card.bracket.consolation.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs tracking-wide text-muted-foreground dark:text-white/45 uppercase">
                  {t('landing.bracket_consolation')} ·{' '}
                  {roundName(card.bracket.consolation[0]?.round_size ?? 0, t)}
                </p>
                <ul className="space-y-1.5">{card.bracket.consolation.map(renderMatch)}</ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
