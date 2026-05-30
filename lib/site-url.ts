/**
 * URL base canónica del sitio, usada para construir enlaces absolutos en
 * emails, avisos de WhatsApp y referencias de pago.
 *
 * Históricamente este valor estaba duplicado en varios módulos con fallbacks
 * divergentes (uno apuntaba a `torneigpadelvinroma-v-2026.vercel.app`, que no
 * existe), de modo que los enlaces de email llegaban rotos. Centralizarlo aquí
 * evita que vuelva a desincronizarse.
 *
 * Orden de resolución:
 *   1. NEXT_PUBLIC_SITE_URL          — dominio configurado explícitamente (prod).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — dominio de producción estable de Vercel
 *                                      (NO el de cada preview, que cambia por commit).
 *   3. Dominio del proyecto Vercel conocido (último recurso).
 */
const PROJECT_FALLBACK_URL = 'https://torneig-local-padel-2026-vinroma.vercel.app';

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim()) return explicit.trim();

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd && vercelProd.trim()) {
    const v = vercelProd.trim();
    return v.startsWith('http') ? v : `https://${v}`;
  }

  return PROJECT_FALLBACK_URL;
}

/** URL base normalizada sin barra final, p.ej. `https://example.com`. */
export function getSiteUrl(): string {
  return resolveSiteUrl().replace(/\/$/, '');
}

/** Host del sitio sin protocolo, p.ej. `example.com` (para feeds `webcal://`). */
export function getSiteHost(): string {
  return getSiteUrl().replace(/^https?:\/\//, '');
}

/**
 * Construye una URL absoluta a partir de un path relativo.
 *   absoluteUrl('/ca/captain') -> 'https://.../ca/captain'
 */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}
