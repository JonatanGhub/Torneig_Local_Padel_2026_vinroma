import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { LogoLockup } from '@/components/brand/logo-mark';
import { LogoutButton } from '@/components/logout-button';
import { CaptainTabs } from './captain-tabs';
import { ReportIssueButton } from './report-issue-button';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
};

export default async function CaptainLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain`);

  const tabs = [
    { href: `/${locale}/captain`, label: t('captain.tab_home') },
    { href: `/${locale}/captain/calendari`, label: t('captain.tab_calendar') },
    { href: `/${locale}/captain/grup`, label: t('captain.tab_group') },
    { href: `/${locale}/captain/quadre`, label: t('captain.tab_bracket') },
    { href: `/${locale}/captain/horaris`, label: t('captain.tab_schedule_prefs') },
    { href: `/${locale}/disponibilitat`, label: t('captain.tab_availability') },
  ];

  return (
    // `dark` força que TOTS els tokens de tema (--background, --secondary...)
    // resolguin als valors foscos dins d'aquesta secció, encara que el mòbil
    // de l'usuari estigui en mode clar: el fons és ink-950 fix, i sense això
    // els inputs sortien blancs amb text blanc heretat (invisible en escriure).
    <div className="dark bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              {t('common.back')}
            </Link>
            <LogoutButton label={t('admin.logout_short')} variant="dark" />
          </div>
        </div>
      </div>

      <CaptainTabs tabs={tabs} />

      {children}

      <ReportIssueButton locale={locale} />
    </div>
  );
}
