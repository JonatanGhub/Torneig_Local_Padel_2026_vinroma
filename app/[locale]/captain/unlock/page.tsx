import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_COOKIE, verifyCookie } from '@/lib/captain/cookies-edge';
import { locales, type Locale } from '@/i18n';
import { UnlockForm } from './unlock-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function UnlockPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params;
  const locale = ((locales as readonly string[]).includes(rawLocale) ? rawLocale : 'ca') as Locale;
  const { next: rawNext } = await searchParams;
  const safeNext = rawNext && rawNext.startsWith('/') ? rawNext : `/${locale}/captain`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(safeNext)}`);
  }

  const { data: player } = await supabase
    .from('players')
    .select('id, pin_hash')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!player) {
    redirect(`/${locale}/captain`);
  }
  if (!player.pin_hash) {
    redirect(`/${locale}/captain/setup-pin?next=${encodeURIComponent(safeNext)}`);
  }

  const cookieStore = await cookies();
  const deviceCookie = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
  let isUnknownDevice = true;
  if (deviceCookie) {
    const { data: device } = await supabase
      .from('captain_devices')
      .select('id')
      .eq('player_id', player.id)
      .eq('device_id', deviceCookie)
      .maybeSingle();
    if (device) isUnknownDevice = false;
  }

  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <main className="dark min-h-screen bg-slate-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{t('unlock_title')}</h1>
          <p className="text-sm text-white/70">{t('unlock_subtitle')}</p>
        </header>
        <UnlockForm locale={locale} next={safeNext} isUnknownDevice={isUnknownDevice} />
      </div>
    </main>
  );
}
