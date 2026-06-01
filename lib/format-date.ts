/**
 * Format de dates al fus horari de Madrid (Europe/Madrid).
 *
 * El servidor (Vercel) corre en UTC. Si fem `new Date(iso).toLocaleString(locale)`
 * sense timeZone, surten hores UTC (p.ex. 17:00 enlloc de 19:00 d'estiu). Tot
 * el contingut visible per a l'usuari del torneig ha de mostrar-se en hora de
 * Madrid.
 */

const MADRID_TZ = 'Europe/Madrid';

export function formatMatchDateTime(
  iso: string | null | undefined,
  locale: 'ca' | 'es' = 'ca',
): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
      timeZone: MADRID_TZ,
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function formatMatchDateTimeLong(
  iso: string | null | undefined,
  locale: 'ca' | 'es' = 'ca',
): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
      timeZone: MADRID_TZ,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Hora curta del partit (HH:mm) en Madrid. */
export function formatMatchTime(
  iso: string | null | undefined,
  locale: 'ca' | 'es' = 'ca',
): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
      timeZone: MADRID_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

/**
 * Converteix un instant ISO (UTC) al valor d'un <input type="datetime-local">
 * expressat en hora de Madrid: `YYYY-MM-DDTHH:mm`.
 *
 * Important: NO es pot fer servir `new Date(iso).toISOString().slice(0,16)`
 * perquè això dóna l'hora en UTC (p.ex. 17:00 enlloc de 19:00 a l'estiu).
 */
export function toMadridInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MADRID_TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    let hour = get('hour');
    if (hour === '24') hour = '00';
    return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
  } catch {
    return '';
  }
}

/** Offset (ms) d'Europe/Madrid respecte UTC en un instant donat (gestiona DST). */
function madridOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value);
  let hour = map.hour ?? 0;
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(map.year!, map.month! - 1, map.day!, hour, map.minute, map.second);
  return asUTC - instant;
}

/**
 * Converteix un valor de <input type="datetime-local"> (`YYYY-MM-DDTHH:mm`,
 * interpretat com a hora de paret de Madrid) a un instant ISO en UTC.
 *
 * El servidor corre en UTC, així que `new Date("2026-07-01T19:00")` el
 * llegiria com a UTC i desaria una hora equivocada. Aquí forcem el fus de
 * Madrid abans de convertir.
 */
export function madridInputToISO(naive: string): string {
  const [datePart, timePart] = naive.split('T');
  const [y, mo, d] = (datePart ?? '').split('-').map(Number);
  const [h, mi] = (timePart ?? '00:00').split(':').map(Number);
  const utcGuess = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const offset = madridOffsetMs(utcGuess);
  return new Date(utcGuess - offset).toISOString();
}

/** Clau de dia (`YYYY-MM-DD`) en hora de Madrid a partir d'un instant ISO. */
export function madridDateKey(iso: string | null | undefined): string {
  return toMadridInputValue(iso).slice(0, 10);
}
