import { describe, it, expect } from 'vitest';
import {
  computeCategoryBracket,
  formatSeed,
  type StandingRow,
  type GroupMeta,
  type BracketSeed,
} from '@/lib/bracket-engine';

// Helper: crea una fila de classificació amb un rendiment donat (wins = ordre).
function row(pair: string, group: string, wins: number): StandingRow {
  return {
    pair_id: pair,
    group_label: group,
    matches_played: 99,
    matches_won: wins,
    sets_diff: wins,
    games_diff: wins,
  };
}

// Genera un grup tancat de `size` parelles amb rendiment decreixent: la parella
// `${g}1` és 1a, `${g}2` 2a, etc.
function group(g: string, size: number): { rows: StandingRow[]; meta: GroupMeta } {
  const rows: StandingRow[] = [];
  for (let i = 1; i <= size; i++) rows.push(row(`${g}${i}`, g, size - i));
  return { rows, meta: { label: g, size, closed: true } };
}

const pairId = (s: BracketSeed) => (s.kind === 'pair' ? s.pair_id : `?${s.rank}${s.groupLabel}`);
const sameGroupInRound = (matches: { a: BracketSeed; b: BracketSeed }[]) =>
  matches.some((m) => m.a.groupLabel === m.b.groupLabel);

describe('bracket-engine · 1a (2 grups de 4)', () => {
  const A = group('A', 4);
  const B = group('B', 4);
  const bracket = computeCategoryBracket(1, [...A.rows, ...B.rows], [A.meta, B.meta]);

  it('genera 2 semis principals i 2 de consolació', () => {
    expect(bracket.main).toHaveLength(2);
    expect(bracket.consolation).toHaveLength(2);
    expect(bracket.feasible).toBe(true);
    expect(bracket.groupPhaseFinished).toBe(true);
  });

  it('creua 1A-2B i 1B-2A al principal', () => {
    const pairs = bracket.main.map((m) => [pairId(m.a), pairId(m.b)].sort().join('-')).sort();
    expect(pairs).toEqual(['A1-B2', 'A2-B1'].sort());
  });

  it('creua 3A-4B i 3B-4A a la consolació', () => {
    const pairs = bracket.consolation
      .map((m) => [pairId(m.a), pairId(m.b)].sort().join('-'))
      .sort();
    expect(pairs).toEqual(['A3-B4', 'A4-B3'].sort());
  });
});

describe('bracket-engine · 3a (1 grup de 5 + 1 de 4)', () => {
  const A = group('A', 5);
  const B = group('B', 4);
  const bracket = computeCategoryBracket(3, [...A.rows, ...B.rows], [A.meta, B.meta]);

  it('principal top-2 creuat i consolació 3/4; el 5è queda fora', () => {
    expect(bracket.main).toHaveLength(2);
    expect(bracket.consolation).toHaveLength(2);
    const allPairs = [...bracket.main, ...bracket.consolation].flatMap((m) => [
      pairId(m.a),
      pairId(m.b),
    ]);
    expect(allPairs).not.toContain('A5'); // 5è del grup de 5 exclòs
  });
});

describe('bracket-engine · 4a (1 grup de 5, top-4)', () => {
  const A = group('A', 5);
  const bracket = computeCategoryBracket(4, A.rows, [A.meta]);

  it('genera 2 semis (1-4, 2-3), sense consolació, 5è fora', () => {
    expect(bracket.main).toHaveLength(2);
    expect(bracket.consolation).toHaveLength(0);
    const pairs = bracket.main.map((m) => [pairId(m.a), pairId(m.b)].sort().join('-')).sort();
    expect(pairs).toEqual(['A1-A4', 'A2-A3'].sort());
  });
});

describe('bracket-engine · 2a (2 grups de 5 + 1 de 4)', () => {
  const A = group('A', 5);
  const B = group('B', 5);
  const C = group('C', 4);
  const bracket = computeCategoryBracket(
    2,
    [...A.rows, ...B.rows, ...C.rows],
    [A.meta, B.meta, C.meta],
  );

  it('principal de 8 (4 quarts) i consolació de 4 (2 semis)', () => {
    expect(bracket.main).toHaveLength(4);
    expect(bracket.consolation).toHaveLength(2);
    expect(bracket.feasible).toBe(true);
  });

  it('el principal inclou els 2 primers de cada grup + els 3rs dels grups de 5', () => {
    const inMain = new Set(bracket.main.flatMap((m) => [pairId(m.a), pairId(m.b)]));
    for (const p of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A3', 'B3']) {
      expect(inMain.has(p)).toBe(true);
    }
    expect(inMain.has('C3')).toBe(false); // 3r del grup de 4 va a consolació
    expect(inMain.size).toBe(8);
  });

  it('cap creuament del mateix grup als quarts', () => {
    expect(sameGroupInRound(bracket.main)).toBe(false);
  });

  it('consolació = 3C, 4C, 4A, 4B; els 5ns queden fora', () => {
    const inCons = new Set(bracket.consolation.flatMap((m) => [pairId(m.a), pairId(m.b)]));
    expect(inCons).toEqual(new Set(['C3', 'C4', 'A4', 'B4']));
    expect(inCons.has('A5')).toBe(false);
    expect(inCons.has('B5')).toBe(false);
  });

  it('a consolació, el 3C s’enfronta al millor 4t', () => {
    // A4 té millor rendiment que B4 (wins 1 vs 1 → empat; fem A4 millor)
    const Abetter = group('A', 5);
    const Bworse = {
      rows: [row('B1', 'B', 4), row('B2', 'B', 3), row('B3', 'B', 2), row('B4', 'B', 0)],
      meta: { label: 'B', size: 5, closed: true } as GroupMeta,
    };
    // Forcem A4 amb més victòries que B4.
    Abetter.rows[3] = row('A4', 'A', 2);
    const C2 = group('C', 4);
    const b = computeCategoryBracket(
      2,
      [...Abetter.rows, ...Bworse.rows, ...C2.rows],
      [Abetter.meta, Bworse.meta, C2.meta],
    );
    const semiWith3C = b.consolation.find((m) => pairId(m.a) === 'C3' || pairId(m.b) === 'C3');
    const rival = pairId(semiWith3C!.a) === 'C3' ? pairId(semiWith3C!.b) : pairId(semiWith3C!.a);
    expect(rival).toBe('A4'); // millor 4t
  });
});

describe('bracket-engine · grups oberts', () => {
  it('marca groupPhaseFinished=false i retorna placeholders si un grup no està tancat', () => {
    const A = group('A', 4);
    const B = group('B', 4);
    B.meta.closed = false;
    const bracket = computeCategoryBracket(1, [...A.rows, ...B.rows], [A.meta, B.meta]);
    expect(bracket.groupPhaseFinished).toBe(false);
    // Els seeds del grup B han de ser placeholders.
    const bSeeds = bracket.main.flatMap((m) => [m.a, m.b]).filter((s) => s.groupLabel === 'B');
    expect(bSeeds.every((s) => s.kind === 'placeholder')).toBe(true);
  });
});

describe('bracket-engine · formatSeed', () => {
  it('formata ordinals en català i castellà', () => {
    const seed: BracketSeed = { kind: 'placeholder', rank: 1, groupLabel: 'A' };
    expect(formatSeed(seed, 'ca')).toBe('1r A');
    expect(formatSeed(seed, 'es')).toBe('1º A');
  });
});
