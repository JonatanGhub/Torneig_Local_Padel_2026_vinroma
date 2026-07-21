import { madridDateKey } from '@/lib/format-date';

// Horari oficial del torneig 2026 (fase de grups): dilluns–dijous, Pista 2 i
// Pista 3, a les 20:30 i 22:00. Compartit entre la cerca de forats lliures
// per reprogramar (captain/matches/[id]/actions.ts) i la graella pública de
// disponibilitat (app/[locale]/disponibilitat).
export const OFFICIAL_TIMES = ['20:30', '22:00'] as const;
export const OFFICIAL_COURTS = ['Pista 2', 'Pista 3'] as const;
// A l'eliminatòria (última setmana) s'obre també la Pista 1.
export const KO_COURTS = ['Pista 1', 'Pista 2', 'Pista 3'] as const;
export const SUMMER_OFFSET = '+02:00';
export const GROUP_PHASE_LAST_DAY = '2026-07-30';

export function officialDaysMonToThu(fromISO: string, toISO: string): string[] {
  const days: string[] = [];
  const startKey = madridDateKey(fromISO);
  const endKey = madridDateKey(toISO);
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!, 12));
  const last = new Date(Date.UTC(ey!, em! - 1, ed!, 12));
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 4) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cur.getUTCDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export function buildOccupiedSlots(
  scheduled: { scheduled_at: string | null; court_label: string | null }[],
): Set<string> {
  const occupied = new Set<string>();
  for (const m of scheduled) {
    if (!m.scheduled_at || !m.court_label) continue;
    occupied.add(`${new Date(m.scheduled_at).toISOString()}|${m.court_label}`);
  }
  return occupied;
}
