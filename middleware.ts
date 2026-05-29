import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n';
import { updateSession } from './lib/supabase/middleware';
import { captainGuardRedirect } from './lib/captain/middleware-guard';

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'as-needed',
});

export async function middleware(request: NextRequest) {
  // Bloqueja l'acces al panell de capita si:
  // - encara no te PIN configurat (-> /captain/setup-pin)
  // - han passat >24h des de l'ultim PIN ok (-> /captain/unlock)
  // - el dispositiu actual no esta registrat com de confianca (-> unlock)
  const captainRedirect = await captainGuardRedirect(request);
  if (captainRedirect) return captainRedirect;

  const intlResponse = intlMiddleware(request);
  return updateSession(request, intlResponse);
}

export const config = {
  // Excluye /api, /auth (route handlers fuera de [locale] como /auth/callback),
  // assets de Next y archivos con extensión. Para que next-intl no reescriba
  // /auth/callback → /es/auth/callback (que daría 404).
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
