import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { LogoLockup } from '@/components/brand/logo-mark';
import { CaptainTabs } from './captain-tabs';

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
  ];

  return (
    <div className="bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t('common.back')}
          </Link>
        </div>
      </div>

      <CaptainTabs tabs={tabs} />

      {children}
    </div>
  );
}
