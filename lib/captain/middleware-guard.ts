// =========================================================================
// Middleware guard del panell de capità.
//
// Decideix si una request a /[locale]/captain/* requereix passar primer per
// /captain/setup-pin (encara no té PIN) o /captain/unlock (sessió >24h o
// dispositiu desconegut).
// =========================================================================

import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { locales } from '@/i18n';
import { UNLOCK_COOKIE, UNLOCK_TTL_SECONDS, verifyCookie } from '@/lib/captain/cookies-edge';
import type { Database } from '@/types/supabase';

const CAPTAIN_PATH = /^\/(?:(ca|es)\/)?captain(\/.*)?$/;

function parseCaptainPath(pathname: string): {
  isCaptain: boolean;
  locale: 'ca' | 'es';
  rest: string;
} {
  const match = CAPTAIN_PATH.exec(pathname);
  if (!match) return { isCaptain: false, locale: 'ca', rest: '' };
  const locale = (match[1] as 'ca' | 'es' | undefined) ?? 'ca';
  const rest = match[2] ?? '';
  return { isCaptain: true, locale, rest };
}

// `user` i `supabase` venen ja resolts de updateSession() (lib/supabase/
// middleware.ts): evita cridar auth.getUser() una segona vegada (petició de
// xarxa real a Supabase Auth) en cada request a /captain/*.
export async function captainGuardRedirect(
  request: NextRequest,
  user: { id: string } | null,
  supabase: SupabaseClient<Database>,
): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const { isCaptain, locale, rest } = parseCaptainPath(url.pathname);
  if (!isCaptain) return null;

  // Mai redirigir des de les pàgines de gestió del propi PIN.
  if (rest.startsWith('/unlock') || rest.startsWith('/setup-pin')) {
    return null;
  }

  // Validem que el locale és conegut (per si la regex falla a l'edge).
  if (!(locales as readonly string[]).includes(locale)) return null;

  // No autenticat → deixem el flux normal (el layout del captain redirigeix
  // a /login).
  if (!user) return null;

  // Busquem el player vinculat.
  const { data: player } = await supabase
    .from('players')
    .select('id, pin_hash')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  // Sense player → ho deixem al layout (mostra NoProfile).
  if (!player) return null;

  const nextParam = encodeURIComponent(url.pathname + url.search);

  // Sense PIN configurat → setup.
  if (!player.pin_hash) {
    const dest = new URL(`/${locale}/captain/setup-pin?next=${nextParam}`, url);
    return NextResponse.redirect(dest);
  }

  // Sessió de PIN encara vàlida (<24h)?
  const unlockedAt = await verifyCookie(request.cookies.get(UNLOCK_COOKIE)?.value);
  if (unlockedAt) {
    const ts = Number.parseInt(unlockedAt, 10);
    if (Number.isFinite(ts)) {
      const ageSec = Math.floor(Date.now() / 1000) - ts;
      if (ageSec >= 0 && ageSec < UNLOCK_TTL_SECONDS) {
        return null;
      }
    }
  }

  // Cap a unlock; la pàgina detectarà si el dispositiu és nou i, en cas
  // afirmatiu, demanarà al capità tornar a fer magic-link.
  const dest = new URL(`/${locale}/captain/unlock?next=${nextParam}`, url);
  return NextResponse.redirect(dest);
}
