import {
  computeCategoryBracket,
  formatSeed,
  type StandingRow,
  type GroupMeta,
  type BracketSeed,
  type CategoryBracket,
} from './bracket-engine';

export type ScheduleSlot = { matchDate: string; matchTime: string; courtLabel: string };

export type ProjectionCard = {
  id: string;
  level: number;
  name: string;
  bracket: CategoryBracket;
  // position (dins la ronda 1 del quadre, l'única que es pot preveure) →
  // horari fix acordat. `main` per al quadre principal, `cons` per al de
  // consolació.
  mainSchedule: Map<number, ScheduleSlot>;
  consSchedule: Map<number, ScheduleSlot>;
};

type ProjectionCategoryInput = { id: string; level: number; name_ca: string; name_es: string };
type ProjectionGroupInput = { id: string; category_id: string; label: string };
type ProjectionPairInput = { category_id: string | null; group_id: string | null };
type ProjectionStandingInput = {
  pair_id: string;
  category_id: string;
  group_id: string | null;
  matches_played: number;
  matches_won: number;
  sets_diff: number;
  games_diff: number;
};
type ProjectionGroupMatchInput = {
  category_id: string;
  group_label: string | null;
  status: string;
};
export type ProjectionScheduleInput = {
  category_level: number;
  bracket: 'ko' | 'cons';
  round_number: number;
  position: number;
  match_date: string;
  match_time: string;
  court_label: string;
};

// Construeix, per a cada categoria amb grups sortejats, el quadre eliminatori
// que en resultaria AMB ELS RESULTATS ACTUALS (encara que la fase de grups no
// hagi acabat: els slots no fixats surten com a placeholder "1r A"). Pur —
// no toca la base de dades — perquè el pugui fer servir tant la pàgina
// pública (abans que es generi el quadre real) com el panell de capità.
export function buildBracketProjectionCards(
  locale: 'ca' | 'es',
  categories: ProjectionCategoryInput[],
  groups: ProjectionGroupInput[],
  pairs: ProjectionPairInput[],
  standings: ProjectionStandingInput[],
  groupMatches: ProjectionGroupMatchInput[],
  schedule: ProjectionScheduleInput[] = [],
): ProjectionCard[] {
  const labelByGroupId = new Map(groups.map((g) => [g.id, g.label]));

  return categories
    .map((c) => {
      const catGroups = groups.filter((g) => g.category_id === c.id);
      if (catGroups.length === 0) return null;

      const catPairs = pairs.filter((p) => p.category_id === c.id);
      const sizeByLabel = new Map<string, number>();
      for (const p of catPairs) {
        const label = p.group_id ? labelByGroupId.get(p.group_id) : null;
        if (label) sizeByLabel.set(label, (sizeByLabel.get(label) ?? 0) + 1);
      }

      const closedByLabel = new Map<string, boolean>();
      for (const g of catGroups) closedByLabel.set(g.label, true);
      for (const m of groupMatches) {
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

      const catStandings: StandingRow[] = standings
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

      // Només es pot preveure la RONDA 1 de cada quadre (ko_1/cons_1): les
      // rondes següents depenen de guanyadors encara desconeguts.
      const scheduleFor = (b: 'ko' | 'cons') =>
        new Map(
          schedule
            .filter((s) => s.category_level === c.level && s.bracket === b && s.round_number === 1)
            .map((s) => [
              s.position,
              { matchDate: s.match_date, matchTime: s.match_time, courtLabel: s.court_label },
            ]),
        );

      return {
        id: c.id,
        level: c.level,
        name: locale === 'ca' ? c.name_ca : c.name_es,
        bracket,
        mainSchedule: scheduleFor('ko'),
        consSchedule: scheduleFor('cons'),
      };
    })
    .filter((x): x is ProjectionCard => x !== null);
}

export { formatSeed };
export type { BracketSeed, CategoryBracket };
