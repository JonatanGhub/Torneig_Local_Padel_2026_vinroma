/**
 * Nom complet d'un jugador a partir de la projecció pública
 * `public_player_names` (nom + cognoms). Si falta alguna part, mostra el que
 * hi hagi; si no hi ha res, retorna un guió.
 */
export function fullName(
  p: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
}

/** Etiqueta d'una parella "Nom Cognoms / Nom Cognoms". */
export function pairLabel(
  a: { first_name?: string | null; last_name?: string | null } | null | undefined,
  b: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  return `${fullName(a)} / ${fullName(b)}`;
}
