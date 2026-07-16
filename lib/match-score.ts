export type MatchSetRow = {
  match_id: string;
  set_number: number;
  games_a: number;
  games_b: number;
};

// Agrupa files de `sets` per partit i les converteix en un text tipus
// "6-4, 3-6, 7-5" (ordenat per número de set). Únic punt on es fa aquesta
// conversió perquè el marcador es mostri igual a tot arreu (panell públic de
// grups, panell de grup i inici del capità, admin).
export function buildScoreTextMap(sets: MatchSetRow[] | null | undefined): Map<string, string> {
  const byMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets ?? []) {
    const list = byMatch.get(s.match_id) ?? [];
    list.push(s);
    byMatch.set(s.match_id, list);
  }
  const out = new Map<string, string>();
  for (const [matchId, rows] of byMatch) {
    const sorted = [...rows].sort((a, b) => a.set_number - b.set_number);
    out.set(matchId, sorted.map((s) => `${s.games_a}-${s.games_b}`).join(', '));
  }
  return out;
}
