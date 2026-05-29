import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, locales, type Locale } from '@/i18n';
import { UNLOCK_COOKIE, UNLOCK_TTL_SECONDS, signCookie } from '@/lib/captain/cookies-edge';

// Flux `token_hash` recomanat per Supabase per a SSR. La plantilla d'email
// ha d'enviar l'usuari directament a aquesta ruta, no a `supabase.co/auth/v1/verify`.
//
// Plantilla d'email esperada:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/{locale}/captain
//
// Avantatges vs `?code=` (PKCE):
//   - No depèn de cookies prèvies al navegador.
//   - Funciona des de qualsevol dispositiu/navegador (incloses apps de correu
//     que obren l'enllaç en webview).

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const path = new URL(referer).pathname;
      const seg = path.split('/').filter(Boolean)[0];
      if (seg && (locales as readonly string[]).includes(seg)) {
        return seg as Locale;
      }
    } catch {
      /* noop */
    }
  }
  const accept = request.headers.get('accept-language') ?? '';
  if (accept.toLowerCase().startsWith('es')) return 'es';
  return defaultLocale;
}

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

const VALID_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type');
  const explicitNext = url.searchParams.get('next');
  const locale = detectLocale(request);

  if (!tokenHash || !typeParam || !(VALID_TYPES as string[]).includes(typeParam)) {
    return NextResponse.redirect(`${url.origin}/${locale}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeParam as EmailOtpType,
  });
  if (error) {
    return NextResponse.redirect(`${url.origin}/${locale}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string | undefined) ?? null;

  const target =
    explicitNext && explicitNext.startsWith('/')
      ? explicitNext
      : role === 'admin'
        ? `/${locale}/admin`
        : role === 'captain'
          ? `/${locale}/captain`
          : `/${locale}`;

  const response = NextResponse.redirect(`${url.origin}${target}`);

  // Si l'usuari te perfil de capita (un row a `players`), assumim que el
  // magic-link recent compta com a proof of identity i estampem la cookie
  // d'unlock perque no li demanem el PIN immediatament despres. La cookie
  // de dispositiu nomes es crea explicitament (setup-pin o trustThisDevice).
  if (user) {
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (player) {
      const signed = await signCookie(String(Math.floor(Date.now() / 1000)));
      response.cookies.set(UNLOCK_COOKIE, signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: UNLOCK_TTL_SECONDS,
      });
    }
  }

  return response;
}
