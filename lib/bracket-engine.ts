/**
 * Motor de quadres eliminatoris PERSONALITZAT per al torneig 2026.
 *
 * A diferència de `lib/bracket-preview.ts` (que replica el motor SQL estàndard
 * top-2 / potència de 2), aquest motor implementa el format específic decidit
 * per l'organització per a cada categoria:
 *
 *  - 1a (2 grups de 4):  principal = 1r/2n de cada grup → SF (1A-2B, 1B-2A).
 *                        consolació = 3r/4t de cada grup → SF (3A-4B, 3B-4A).
 *  - 3a (1 grup de 5 + 1 de 4): igual que 1a (top-2 → SF creuades; 3r/4t →
 *                        consolació). El 5è del grup de 5 queda fora.
 *  - 2a (2 grups de 5 + 1 de 4): principal = 1r/2n de cada grup + els dos 3rs
 *                        dels grups de 5 = 8 → quarts amb sembra per rendiment
 *                        evitant creuaments del mateix grup. consolació = 3r i
 *                        4t del grup de 4 + 4t de cada grup de 5 = 4 → SF
 *                        (3C vs millor 4t, 4C vs l'altre 4t). Els 5ns fora.
 *  - 4a (1 grup de 5):   principal = top-4 → SF (1-4, 2-3). 5è fora. Sense
 *                        consolació.
 *
 * Pur: no toca la base de dades. Treballa amb classificacions
 * (`category_standings`) i admet que els grups encara no estiguin tancats
 * (retorna placeholders "1r A" per a posicions no fixades).
 */

export type StandingRow = {
  pair_id: string;
  group_label: string; // 'A', 'B', 'C'
  matches_played: number;
  matches_won: number;
  sets_diff: number;
  games_diff: number;
};

export type GroupMeta = {
  label: string;
  size: number; // nombre de parelles del grup
  closed: boolean; // tots els partits del grup validats
};

export type BracketSeed =
  | { kind: 'pair'; pair_id: string; locked: boolean; rank: number; groupLabel: string }
  | { kind: 'placeholder'; rank: number; groupLabel: string };

export type BracketMatch = {
  phase: 'ko' | 'cons';
  round_size: number; // 2, 4, 8…
  position: number; // 1..round_size/2
  a: BracketSeed;
  b: BracketSeed;
};

export type CategoryBracket = {
  main: BracketMatch[];
  consolation: BracketMatch[];
  /** Tots els grups implicats estan tancats → el quadre és definitiu. */
  groupPhaseFinished: boolean;
  /** El format de la categoria s'ha pogut resoldre amb els grups donats. */
  feasible: boolean;
};

export const ROW_SORT = (a: StandingRow, b: StandingRow): number => {
  if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
  if (a.sets_diff !== b.sets_diff) return b.sets_diff - a.sets_diff;
  if (a.games_diff !== b.games_diff) return b.games_diff - a.games_diff;
  return 0;
};

type Ranked = {
  byGroup: Map<string, StandingRow[]>; // label → files ordenades (index 0 = 1r)
  groupByLabel: Map<string, GroupMeta>;
};

function rank(standings: StandingRow[], groups: GroupMeta[]): Ranked {
  const byGroup = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const arr = byGroup.get(s.group_label) ?? [];
    arr.push(s);
    byGroup.set(s.group_label, arr);
  }
  for (const arr of byGroup.values()) arr.sort(ROW_SORT);
  const groupByLabel = new Map(groups.map((g) => [g.label, g]));
  return { byGroup, groupByLabel };
}

// Fila de classificació per a (grup, rank). undefined si encara no existeix.
function rowAt(r: Ranked, groupLabel: string, rank1: number): StandingRow | undefined {
  return (r.byGroup.get(groupLabel) ?? [])[rank1 - 1];
}

// Construeix un Seed per a (grup, rank). rank és 1-based.
function seedAt(r: Ranked, groupLabel: string, rank1: number): BracketSeed {
  const row = rowAt(r, groupLabel, rank1);
  const closed = r.groupByLabel.get(groupLabel)?.closed ?? false;
  if (row && closed) {
    return { kind: 'pair', pair_id: row.pair_id, locked: true, rank: rank1, groupLabel };
  }
  return { kind: 'placeholder', rank: rank1, groupLabel };
}

// Aparella una llista de seeds amb el patró 1 vs N, 2 vs N-1, …
function buildBracket(seeds: BracketSeed[], phase: 'ko' | 'cons'): BracketMatch[] {
  const n = seeds.length;
  const out: BracketMatch[] = [];
  for (let k = 1; k <= n / 2; k++) {
    out.push({ phase, round_size: n, position: k, a: seeds[k - 1]!, b: seeds[n - k]! });
  }
  return out;
}

const seedGroup = (s: BracketSeed): string => s.groupLabel;

// ---------------------------------------------------------------------------
// Formats per categoria
// ---------------------------------------------------------------------------

// 1a i 3a: 2 grups. Principal top-2 creuat; consolació 3r/4t creuat.
function bracketTwoGroups(r: Ranked, groups: GroupMeta[]): CategoryBracket {
  const labels = groups.map((g) => g.label).sort();
  const [g1, g2] = labels;
  if (!g1 || !g2 || labels.length !== 2) {
    return { main: [], consolation: [], groupPhaseFinished: false, feasible: false };
  }
  // Ordre [1g1, 1g2, 2g1, 2g2] → SF: 1g1-2g2, 1g2-2g1.
  const main = buildBracket(
    [seedAt(r, g1, 1), seedAt(r, g2, 1), seedAt(r, g1, 2), seedAt(r, g2, 2)],
    'ko',
  );
  // Consolació [3g1, 3g2, 4g1, 4g2] → SF: 3g1-4g2, 3g2-4g1.
  const cons = buildBracket(
    [seedAt(r, g1, 3), seedAt(r, g2, 3), seedAt(r, g1, 4), seedAt(r, g2, 4)],
    'cons',
  );
  return {
    main,
    consolation: cons,
    groupPhaseFinished: groups.every((g) => g.closed),
    feasible: true,
  };
}

// 4a: 1 grup. Principal top-4 (1-4, 2-3). Sense consolació.
function bracketSingleGroupTop4(r: Ranked, groups: GroupMeta[]): CategoryBracket {
  const g = groups[0];
  if (!g || groups.length !== 1) {
    return { main: [], consolation: [], groupPhaseFinished: false, feasible: false };
  }
  const main = buildBracket(
    [seedAt(r, g.label, 1), seedAt(r, g.label, 2), seedAt(r, g.label, 3), seedAt(r, g.label, 4)],
    'ko',
  );
  return { main, consolation: [], groupPhaseFinished: g.closed, feasible: true };
}

// 2a: 2 grups de 5 (A, B) + 1 grup de 4 (C).
function bracketTwoFivesOneFour(r: Ranked, groups: GroupMeta[]): CategoryBracket {
  const fives = groups.filter((g) => g.size === 5).sort((a, b) => a.label.localeCompare(b.label));
  const four = groups.find((g) => g.size === 4);
  if (fives.length !== 2 || !four) {
    return { main: [], consolation: [], groupPhaseFinished: false, feasible: false };
  }
  const [a5, b5] = fives;
  const closedAll = groups.every((g) => g.closed);

  // --- Principal (8): 1r/2n de cada grup + 3r dels dos grups de 5 ---
  // Es sembren per rendiment real (no per ordre fix): el millor balança és el
  // cap de sèrie 1.
  const mainEntries: Array<{ seed: BracketSeed; row?: StandingRow }> = [
    { label: a5!.label, rank: 1 },
    { label: a5!.label, rank: 2 },
    { label: b5!.label, rank: 1 },
    { label: b5!.label, rank: 2 },
    { label: four.label, rank: 1 },
    { label: four.label, rank: 2 },
    { label: a5!.label, rank: 3 },
    { label: b5!.label, rank: 3 },
  ].map((e) => ({ seed: seedAt(r, e.label, e.rank), row: rowAt(r, e.label, e.rank) }));
  mainEntries.sort((x, y) => {
    if (x.row && y.row) return ROW_SORT(x.row, y.row);
    if (x.row) return -1;
    if (y.row) return 1;
    return 0;
  });
  const main = seedEightAvoidingSameGroup(mainEntries.map((e) => e.seed));

  // --- Consolació (4): 3C, 4C, 4A, 4B → SF (3C vs millor 4t, 4C vs l'altre) ---
  const c3 = seedAt(r, four.label, 3);
  const c4 = seedAt(r, four.label, 4);
  const a4row = (r.byGroup.get(a5!.label) ?? [])[3];
  const b4row = (r.byGroup.get(b5!.label) ?? [])[3];
  // "Millor 4t" per rendiment entre 4A i 4B.
  let bestLabel = a5!.label;
  let otherLabel = b5!.label;
  if (a4row && b4row && ROW_SORT(a4row, b4row) > 0) {
    bestLabel = b5!.label;
    otherLabel = a5!.label;
  }
  const best4 = seedAt(r, bestLabel, 4);
  const other4 = seedAt(r, otherLabel, 4);
  // Ordre [3C, 4C, other4, best4] → SF: 3C-best4, 4C-other4.
  const consolation = buildBracket([c3, c4, other4, best4], 'cons');

  return { main, consolation, groupPhaseFinished: closedAll, feasible: true };
}

/**
 * Sembra 8 seeds per rendiment i els aparella 1-8/2-7/3-6/4-5 evitant que dos
 * del mateix grup es creuin a la primera ronda. Manté els 4 millors caps de
 * sèrie a la part alta i permuta l'assignació dels seeds 5–8 per trencar
 * conflictes del mateix grup (cerca exhaustiva, determinista).
 */
function seedEightAvoidingSameGroup(seeds8: BracketSeed[]): BracketMatch[] {
  // Ordena per rendiment: les parelles "pair" primer (per rank dins grup no és
  // suficient entre grups, però el seed real es decideix amb les dades reals;
  // aquí mantenim l'ordre rebut que ja prioritza 1rs > 2ns > 3rs).
  const top = seeds8.slice(0, 4); // caps de sèrie 1–4
  const bottom = seeds8.slice(4); // 5–8

  const standardOrder = [3, 2, 1, 0]; // 1v8,2v7,3v6,4v5 → bottom[3],[2],[1],[0]
  const permutations = permute([0, 1, 2, 3]);
  let chosen: number[] | null = null;
  let chosenCost = Infinity;
  for (const perm of permutations) {
    // perm[i] = índex de `bottom` que enfronta top[i]
    let conflict = false;
    for (let i = 0; i < 4; i++) {
      if (seedGroup(top[i]!) === seedGroup(bottom[perm[i]!]!)) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;
    // Cost: distància respecte l'aparellament estàndard (menys = més just).
    let cost = 0;
    for (let i = 0; i < 4; i++) cost += Math.abs(perm[i]! - standardOrder[i]!);
    if (cost < chosenCost) {
      chosenCost = cost;
      chosen = perm;
    }
  }
  const order = chosen ?? standardOrder; // si no hi ha cap sense conflicte, estàndard
  // Quarts en l'ordre dels caps de sèrie: top[0]=1, top[1]=2, top[2]=3, top[3]=4.
  const bySeed: BracketMatch[] = [];
  for (let i = 0; i < 4; i++) {
    bySeed.push({ phase: 'ko', round_size: 8, position: i + 1, a: top[i]!, b: bottom[order[i]!]! });
  }
  // Reordena a posicions de quadre estàndard perquè, amb l'aparellament
  // consecutiu de la ronda següent (M1-M2, M3-M4), els caps de sèrie 1 i 2
  // quedin a meitats oposades: SF1 = s1 vs s4, SF2 = s2 vs s3.
  const slotOrder = [0, 3, 1, 2]; // s1, s4, s2, s3
  return slotOrder.map((seedIdx, pos) => ({ ...bySeed[seedIdx]!, position: pos + 1 }));
}

function permute(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const res: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) res.push([arr[i]!, ...p]);
  }
  return res;
}

/**
 * Punt d'entrada: calcula el quadre d'una categoria segons el seu nivell.
 *  - level 1 → 2 grups (top-2 + consolació 3/4)
 *  - level 2 → 2 grups de 5 + 1 de 4 (8 al principal amb 3rs, consolació de 4)
 *  - level 3 → 2 grups (igual que level 1; 5è del grup de 5 fora)
 *  - level 4 → 1 grup, top-4
 */
export function computeCategoryBracket(
  level: number,
  standings: StandingRow[],
  groups: GroupMeta[],
): CategoryBracket {
  const r = rank(standings, groups);
  if (level === 4) return bracketSingleGroupTop4(r, groups);
  if (level === 2) return bracketTwoFivesOneFour(r, groups);
  // level 1 i 3: dos grups.
  return bracketTwoGroups(r, groups);
}

/** Etiqueta localitzada d'un slot: "1r A", "2n B"… */
export function formatSeed(seed: BracketSeed, locale: 'ca' | 'es' = 'ca'): string {
  const ord =
    locale === 'ca'
      ? (['', '1r', '2n', '3r', '4t', '5è'][seed.rank] ?? `${seed.rank}è`)
      : `${seed.rank}º`;
  return `${ord} ${seed.groupLabel}`;
}
