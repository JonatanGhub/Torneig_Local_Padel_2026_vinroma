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
