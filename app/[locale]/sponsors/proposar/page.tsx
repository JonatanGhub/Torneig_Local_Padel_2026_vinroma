import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { LogoLockup } from '@/components/brand/logo-mark';
import { ProposeSponsorForm } from './propose-form';

type Props = { params: Promise<{ locale: Locale }> };

export default async function ProposeSponsorPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sponsors');

  return (
    <div className="dark bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <Link
            href={`/${locale}/sponsors`}
            className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t('propose_back')}
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-10 text-center">
          <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {t('propose_form_title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-white/65">
            {t('propose_form_subtitle')}
          </p>
        </header>

        <ProposeSponsorForm locale={locale} />
      </main>
    </div>
  );
}
