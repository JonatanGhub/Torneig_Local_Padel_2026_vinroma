import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { locales, type Locale } from '@/i18n';
import { SetupPinForm } from './setup-pin-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function SetupPinPage({ params, searchParams }: Props) {
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
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!player) {
    redirect(`/${locale}/captain`);
  }

  const defaultLabel = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();

  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{t('pin_setup_title')}</h1>
          <p className="text-sm text-white/70">{t('pin_setup_subtitle')}</p>
        </header>
        <SetupPinForm next={safeNext} defaultLabel={defaultLabel || undefined} />
      </div>
    </main>
  );
}
