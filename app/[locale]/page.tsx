import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, MapPin, Trophy } from 'lucide-react';
import type { Locale } from '@/i18n';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-bold tracking-tight">
          {t('common.tournament_name')}
        </Link>
        <nav className="flex gap-6 text-sm">
          <Link
            href={`/${locale === 'ca' ? 'es' : 'ca'}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {locale === 'ca' ? 'ES' : 'CA'}
          </Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            {t('navigation.login')}
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
            {t('landing.hero_subtitle')}
          </p>
          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            {t('landing.hero_title')}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-3">
          <div className="text-muted-foreground flex items-center justify-center gap-2">
            <Calendar className="size-4" />
            <span>{t('landing.dates')}</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-center gap-2">
            <MapPin className="size-4" />
            <span>
              {t('landing.venue')} · {t('landing.courts_count')}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-center gap-2">
            <Trophy className="size-4" />
            <span>4 categories</span>
          </div>
        </div>

        <p className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2 text-sm">
          {t('landing.registration_opens')}
        </p>
      </section>

      <footer className="border-border text-muted-foreground border-t px-6 py-4 text-center text-xs">
        <p>
          {t('footer.organized_by')} · {t('footer.edition')}
        </p>
      </footer>
    </main>
  );
}
