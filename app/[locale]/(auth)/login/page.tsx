import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { DEVICE_COOKIE, verifyCookie } from '@/lib/captain/cookies-edge';
import { LoginForm } from './login-form';
import { PinLoginForm } from './pin-login-form';
import type { Locale } from '@/i18n';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
};

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const next = sp.next && sp.next.startsWith('/') ? sp.next : null;
  const showAuthError = sp.error === 'auth';
  const forceEmailMode = sp.mode === 'email';

  // Si ja hi ha sessió de Supabase activa, no demanem res. Redirigim segons
  // rol (admin → /admin, capità → /captain, altres → home).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? null;
    const target = next
      ? next
      : role === 'admin'
        ? `/${locale}/admin`
        : role === 'captain'
          ? `/${locale}/captain`
          : `/${locale}`;
    redirect(target);
  }

  // Si NO té sessió però SÍ té un dispositiu de confiança amb PIN configurat,
  // mostrem entrada per PIN. Així evitem que la gent hagi de demanar un nou
  // magic-link cada vegada. L'usuari pot forçar el formulari email amb
  // ?mode=email (link a sota del PIN).
  let pinPlayer: { first_name: string | null } | null = null;
  if (!forceEmailMode) {
    const cookieStore = await cookies();
    const deviceId = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
    if (deviceId) {
      const service = createServiceClient();
      const { data: device } = await service
        .from('captain_devices')
        .select('player_id')
        .eq('device_id', deviceId)
        .maybeSingle();
      if (device) {
        const { data: player } = await service
          .from('players')
          .select('first_name, pin_hash, is_anonymized')
          .eq('id', device.player_id)
          .maybeSingle();
        if (player?.pin_hash && !player.is_anonymized) {
          pinPlayer = { first_name: player.first_name };
        }
      }
    }
  }

  const headingKey = pinPlayer ? 'auth.login_pin_title' : 'auth.login_title';
  const subtitleKey = pinPlayer ? 'auth.login_pin_subtitle_short' : 'auth.login_subtitle';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(headingKey as 'auth.login_title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t(subtitleKey as 'auth.login_subtitle')}</p>
        </div>

        {showAuthError && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {t('auth.link_failed_use_code')}
          </div>
        )}

        {pinPlayer ? (
          <PinLoginForm playerFirstName={pinPlayer.first_name} locale={locale} next={next} />
        ) : (
          <LoginForm next={next} />
        )}

        <p className="text-muted-foreground text-center text-xs">
          <Link href="/" className="hover:text-foreground">
            ← {t('common.back')}
          </Link>
        </p>
      </div>
    </main>
  );
}
