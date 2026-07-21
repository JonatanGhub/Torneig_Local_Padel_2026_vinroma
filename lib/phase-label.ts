import type { MatchCardPhase } from '@/components/match/match-card';

// Les fases reals a `matches.phase` són 'group', 'ko_1', 'ko_2', 'ko_3',
// 'cons_1', 'cons_2' — el NÚMERO és la RONDA (1a, 2a...), no la mida del
// quadre. Quantes rondes té cada quadre depèn del format de la categoria
// (torneig 2026): la 2a categoria juga un principal de 8 (quarts → semis →
// final, 3 rondes); la resta de quadres (principals de 4 i consolacions)
// tenen 2 rondes (semis → final). Amb això es pot saber quina ronda "és"
// cada fase comptant des del final.
function totalRounds(bracket: 'ko' | 'cons', categoryLevel: number | null | undefined): number {
  return bracket === 'ko' && categoryLevel === 2 ? 3 : 2;
}

function parsePhase(phase: string): { bracket: 'ko' | 'cons'; round: number } | null {
  const m = phase.match(/^(ko|cons)_(\d+)$/);
  if (!m) return null;
  return { bracket: m[1] as 'ko' | 'cons', round: Number(m[2]) };
}

/**
 * Converteix una fase real de la BD al `phase` que espera MatchCard.
 * Per a fases eliminatòries cal el `level` de la categoria per saber en
 * quina ronda del quadre estem.
 */
export function matchCardPhase(
  phase: string,
  categoryLevel: number | null | undefined,
): MatchCardPhase {
  if (phase === 'group') return 'group';
  const parsed = parsePhase(phase);
  if (!parsed) return null;
  const fromEnd = totalRounds(parsed.bracket, categoryLevel) - parsed.round;
  const main: MatchCardPhase[] = ['final', 'sf', 'qf', 'r16'];
  const cons: MatchCardPhase[] = ['cons_final', 'cons_sf', 'cons_qf', 'cons_qf'];
  const idx = Math.max(0, Math.min(3, fromEnd));
  return parsed.bracket === 'ko' ? main[idx]! : cons[idx]!;
}

const ROUND_TEXT: Record<string, Record<'ca' | 'es', string>> = {
  final: { ca: 'Final', es: 'Final' },
  sf: { ca: 'Semifinal', es: 'Semifinal' },
  qf: { ca: 'Quarts de final', es: 'Cuartos de final' },
  r16: { ca: 'Vuitens de final', es: 'Octavos de final' },
  cons_final: { ca: 'Final de consolació', es: 'Final de consolación' },
  cons_sf: { ca: 'Semifinal de consolació', es: 'Semifinal de consolación' },
  cons_qf: { ca: 'Quarts de consolació', es: 'Cuartos de consolación' },
};

/**
 * Text llarg de la ronda ("Quarts de final", "Semifinal de consolació"...)
 * per a llistes, missatges de WhatsApp, etc. Retorna null per a 'group' o
 * fases desconegudes (el caller ja mostra el grup en aquest cas).
 */
export function phaseRoundText(
  phase: string,
  categoryLevel: number | null | undefined,
  locale: 'ca' | 'es' = 'ca',
): string | null {
  const card = matchCardPhase(phase, categoryLevel);
  if (!card || card === 'group') return null;
  return ROUND_TEXT[card]?.[locale] ?? null;
}

/** True si la fase és la FINAL del quadre principal (per missatges 🏆). */
export function isMainFinal(phase: string, categoryLevel: number | null | undefined): boolean {
  return matchCardPhase(phase, categoryLevel) === 'final';
}

/** True per a qualsevol fase eliminatòria (principal o consolació). */
export function isKnockoutPhase(phase: string): boolean {
  return parsePhase(phase) !== null;
}
