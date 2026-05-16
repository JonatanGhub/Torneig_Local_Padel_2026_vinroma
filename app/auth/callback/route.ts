import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, locales, type Locale } from '@/i18n';

function detectLocale(request: NextRequest): Locale {
  // Preferencia 1: cookie de next-intl si existe
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  // Preferencia 2: referer (de dónde viene el usuario en la app)
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
  // Preferencia 3: Accept-Language
  const accept = request.headers.get('accept-language') ?? '';
  if (accept.toLowerCase().startsWith('es')) return 'es';
  return defaultLocale;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const explicitNext = url.searchParams.get('next');
  const locale = detectLocale(request);

  if (!code) {
    return NextResponse.redirect(`${url.origin}/${locale}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${url.origin}/${locale}/login?error=auth`);
  }

  // Si el caller mandó un `next` explícito (p.ej. desde un guard), úsalo.
  if (explicitNext && explicitNext.startsWith('/')) {
    return NextResponse.redirect(`${url.origin}${explicitNext}`);
  }

  // Si no, redirige según el rol del usuario recién autenticado.
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
