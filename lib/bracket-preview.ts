/**
 * Vista prèvia del cuadre (KO + consolació) abans de generar-lo.
 *
 * Replica la lògica de la funció SQL `generate_knockout` però treballant en
 * memòria i admetent que la classificació encara no estigui tancada: si una
 * posició encara no està "guanyada" (perquè queden partits pel grup que poden
 * canviar-la), retorna un placeholder tipus "1r Grup A".
 *
 * Pur: no toca la base de dades, no fa servir Supabase. Es pot testejar i
 * cridar des de qualsevol component servidor.
 */

export type StandingRow = {
  pair_id: string;
  group_id: string;
  matches_played: number;
  matches_won: number;
  sets_diff: number;
  games_diff: number;
};

export type GroupInfo = {
  id: string;
  label: string;
  total_matches: number;
  played_matches: number;
};

export type PreviewSlot =
  | {
      kind: 'pair';
      pair_id: string;
      locked: boolean;
      // Posició al grup (rank=1 → 1r del grup). Útil per a la UI.
      rank: number;
      groupLabel: string;
    }
  | { kind: 'placeholder'; rank: number; groupLabel: string };

export type PreviewMatch = {
  phase: 'ko' | 'cons';
  round_size: number; // 2, 4, 8…
  position: number; // 1..round_size/2
  a: PreviewSlot;
  b: PreviewSlot;
};

export type BracketPreview = {
  main: PreviewMatch[];
  consolation: PreviewMatch[];
  mainSize: number;
  consSize: number;
  /** El primer round del KO és potència de 2 (2/4/8). null si la categoria no n'admet. */
  feasible: boolean;
  /** True si tots els partits de grup ja són definitius i la previsualització coincidiria amb el sorteig real. */
  groupPhaseFinished: boolean;
};

const ROW_SORT = (a: StandingRow, b: StandingRow) => {
  if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
  if (a.sets_diff !== b.sets_diff) return Number(b.sets_diff - a.sets_diff);
  if (a.games_diff !== b.games_diff) return Number(b.games_diff - a.games_diff);
  return 0;
};

const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

/**
 * Calcula la previsualització del cuadre per a una categoria a partir de les
 * classificacions (`category_standings`) i la informació de grups.
 *
 * - `standings` ha de contenir TOTES les parelles de la categoria (encara
 *   que tinguin 0 partits jugats). Així la previsualització es pot dibuixar
 *   fins i tot abans de jugar res.
 * - `groups` ha de contenir total/played matches per saber si la classificació
 *   d'aquell grup és definitiva. Les posicions d'un grup tancat queden
 *   bloquejades; les d'un grup obert es marquen com a no fixades (placeholder).
 */
export function computeBracketPreview(
  standings: StandingRow[],
  groups: GroupInfo[],
): BracketPreview {
  // Ranking dins cada grup.
  const byGroup = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const arr = byGroup.get(s.group_id) ?? [];
    arr.push(s);
    byGroup.set(s.group_id, arr);
  }
  for (const arr of byGroup.values()) arr.sort(ROW_SORT);

  // Ordenem els grups per `label` (mateix criteri que generate_knockout: ORDER BY glabel).
  const groupsSorted = [...groups].sort((a, b) => a.label.localeCompare(b.label));
  const groupClosed = new Map(
    groupsSorted.map((g) => [g.id, g.total_matches > 0 && g.played_matches === g.total_matches]),
  );

  // Seeds: row_number() OVER (ORDER BY grp_rank, glabel). Recreem la mateixa
  // seqüència iterant per rank i, dins de cada rank, pels grups en ordre de
  // label. Particionem: rank<=2 → main, rank>=3 → consolació.
  const mainSeeds: Seed[] = [];
  const consSeeds: Seed[] = [];
  const maxRank = Math.max(0, ...Array.from(byGroup.values()).map((arr) => arr.length));
  for (let rank = 1; rank <= maxRank; rank++) {
    for (const g of groupsSorted) {
      const arr = byGroup.get(g.id) ?? [];
      const row = arr[rank - 1];
      const closed = groupClosed.get(g.id) ?? false;
      const seed: Seed = {
        pair_id: row?.pair_id ?? null,
        rank,
        groupLabel: g.label,
        locked: closed && !!row,
      };
      if (rank <= 2) mainSeeds.push(seed);
      else consSeeds.push(seed);
    }
  }

  const groupPhaseFinished =
    groupsSorted.length > 0 && groupsSorted.every((g) => groupClosed.get(g.id) === true);

  return {
    main: buildBracket(mainSeeds, 'ko'),
    consolation: buildBracket(consSeeds, 'cons'),
    mainSize: mainSeeds.length,
    consSize: consSeeds.length,
    feasible:
      isPowerOfTwo(mainSeeds.length) && (consSeeds.length === 0 || isPowerOfTwo(consSeeds.length)),
    groupPhaseFinished,
  };
}

type Seed = { pair_id: string | null; rank: number; groupLabel: string; locked: boolean };

function buildBracket(seeds: Seed[], phase: 'ko' | 'cons'): PreviewMatch[] {
  const n = seeds.length;
  if (!isPowerOfTwo(n)) return [];
  const out: PreviewMatch[] = [];
  // Creuaments 1 vs N, 2 vs N-1, ... — mateix patró que la funció SQL.
  for (let k = 1; k <= n / 2; k++) {
    const a = seeds[k - 1]!;
    const b = seeds[n - k]!;
    out.push({
      phase,
      round_size: n,
      position: k,
      a: toSlot(a),
      b: toSlot(b),
    });
  }
  return out;
}

function toSlot(s: Seed): PreviewSlot {
  if (s.pair_id) {
    return {
      kind: 'pair',
      pair_id: s.pair_id,
      locked: s.locked,
      rank: s.rank,
      groupLabel: s.groupLabel,
    };
  }
  return { kind: 'placeholder', rank: s.rank, groupLabel: s.groupLabel };
}

/** Format del placeholder per UI: "1r G1", "2n Grup A"… Localitzat. */
export function formatSlotPlaceholder(slot: PreviewSlot, locale: 'ca' | 'es' = 'ca'): string {
  const ord = locale === 'ca' ? catalanOrdinal(slot.rank) : spanishOrdinal(slot.rank);
  return `${ord} ${slot.groupLabel}`;
}

function catalanOrdinal(n: number): string {
  if (n === 1) return '1r';
  if (n === 2) return '2n';
  if (n === 3) return '3r';
  if (n === 4) return '4t';
  return `${n}è`;
}

function spanishOrdinal(n: number): string {
  return `${n}º`;
}
