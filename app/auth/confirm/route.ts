import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, locales, type Locale } from '@/i18n';

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

  if (explicitNext && explicitNext.startsWith('/')) {
    return NextResponse.redirect(`${url.origin}${explicitNext}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string | undefined) ?? null;

  const target =
    role === 'admin'
      ? `/${locale}/admin`
      : role === 'captain'
        ? `/${locale}/captain`
        : `/${locale}`;
  return NextResponse.redirect(`${url.origin}${target}`);
}
