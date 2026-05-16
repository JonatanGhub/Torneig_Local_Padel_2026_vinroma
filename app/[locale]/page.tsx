import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarClock,
  MapPin,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import type { Locale } from '@/i18n';
import { CourtCarousel } from '@/components/brand/court-carousel';
import { LogoLockup } from '@/components/brand/logo-mark';

type Props = { params: Promise<{ locale: Locale }> };

const SLIDES = [
  { src: '/images/courts/1.png', alt: 'Pistes de pàdel — Les Coves de Vinromà' },
  { src: '/images/courts/2.png', alt: 'Pista exterior amb vallat — Les Coves de Vinromà' },
  { src: '/images/courts/3.png', alt: 'Pistes de pàdel al capvespre — Les Coves de Vinromà' },
];

const KEY_DATES: Array<{
  icon: typeof Calendar;
  labelKey: 'date_opens' | 'date_close' | 'date_draw' | 'date_first_match' | 'date_final';
  dateCa: string;
  dateEs: string;
}> = [
  { icon: Calendar, labelKey: 'date_opens', dateCa: '1 de juny', dateEs: '1 de junio' },
  { icon: CalendarClock, labelKey: 'date_close', dateCa: '30 de juny', dateEs: '30 de junio' },
  { icon: Sparkles, labelKey: 'date_draw', dateCa: '1 de juliol', dateEs: '1 de julio' },
  {
    icon: CalendarCheck,
    labelKey: 'date_first_match',
    dateCa: '6 de juliol',
    dateEs: '6 de julio',
  },
  { icon: Trophy, labelKey: 'date_final', dateCa: "9 d'agost", dateEs: '9 de agosto' },
];

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const otherLocale: Locale = locale === 'ca' ? 'es' : 'ca';

  return (
    <div className="bg-ink-950 relative min-h-screen overflow-hidden text-white">
      {/* Fondo principal: gradiente estático (sin animación pesada) */}
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      {/* NAV: única zona con backdrop-filter para rendimiento */}
      <div className="sticky top-4 z-40 mx-auto flex max-w-6xl items-center justify-between px-4">
        <div className="liquid-glass-dark flex w-full items-center justify-between rounded-full px-4 py-2.5 sm:px-5">
          <LogoLockup />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <NavLink href={`/${locale}/grups`}>{t('navigation.groups')}</NavLink>
            <NavLink href={`/${locale}/calendari`}>{t('navigation.calendar')}</NavLink>
            <NavLink href={`/${otherLocale}`} compact>
              {otherLocale.toUpperCase()}
            </NavLink>
            <Link
              href={`/${locale}/login`}
              className="text-ink-900 ml-2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold transition-transform hover:scale-105"
            >
              {t('navigation.login')}
              <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </div>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-24 md:grid-cols-2 md:pt-24">
        <div className="space-y-7">
          <div className="bg-crimson-500/10 border-crimson-500/30 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium text-white/90">
            <span className="bg-crimson-400 relative inline-flex size-2 rounded-full" />
            {t('landing.hero_subtitle')}
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-balance md:text-7xl">
            <span className="text-gradient-crimson">{t('landing.hero_title')}</span>
          </h1>
          <p className="max-w-md text-lg text-balance text-white/75">{t('landing.hero_tagline')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/inscripcio`}
              className="glow-crimson bg-crimson-600 hover:bg-crimson-500 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
            >
              {t('landing.registration_open_cta')}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`/${locale}/grups`}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              {t('landing.see_groups_cta')}
            </Link>
          </div>

          <p className="text-xs text-white/55">{t('landing.registration_opens')}</p>
        </div>

        {/* CARRUSEL — sin logo flotante encima */}
        <div className="relative aspect-[4/3] w-full">
          <CourtCarousel
            slides={SLIDES}
            className="relative h-full w-full rounded-3xl border border-white/10 shadow-2xl"
          />

          {/* Chips estáticos (sin backdrop-filter para no afectar al scroll) */}
          <div className="absolute top-5 left-5 z-10 space-y-2">
            <Chip icon={<Trophy className="size-3.5" />}>
              {t('landing.stat_categories', { count: 4 })}
            </Chip>
            <Chip icon={<Users className="size-3.5" />}>
              {t('landing.stat_pairs', { count: 32 })}
            </Chip>
            <Chip icon={<MapPin className="size-3.5" />}>{t('landing.stat_courts')}</Chip>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
              {t('landing.timeline_eyebrow')}
            </p>
            <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {t('landing.timeline_title')}
            </h2>
          </div>
          <Link
            href={`/${locale}/calendari`}
            className="inline-flex items-center gap-1 text-sm text-white/65 hover:text-white"
          >
            {t('landing.see_full_calendar')}
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <ol className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {KEY_DATES.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.labelKey}
                className="glass-card hover:border-crimson-400/40 group rounded-2xl p-5 transition-colors"
              >
                <div className="bg-crimson-500/15 text-crimson-300 mb-3 inline-flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <p className="text-xs tracking-wide text-white/55 uppercase">
                  {t(`landing.${step.labelKey}` as 'landing.date_opens')}
                </p>
                <p className="font-display mt-1 text-xl font-semibold text-white">
                  {locale === 'ca' ? step.dateCa : step.dateEs}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* CARDS */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        <InfoCard
          eyebrow={t('landing.card_venue_eyebrow')}
          title={t('landing.card_venue_title')}
          body={t('landing.card_venue_body')}
          icon={<MapPin className="size-5" />}
        />
        <InfoCard
          eyebrow={t('landing.card_format_eyebrow')}
          title={t('landing.card_format_title')}
          body={t('landing.card_format_body')}
          icon={<Trophy className="size-5" />}
        />
        <InfoCard
          eyebrow={t('landing.card_pricing_eyebrow')}
          title={t('landing.card_pricing_title')}
          body={t('landing.card_pricing_body')}
          icon={<Sparkles className="size-5" />}
        />
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="from-crimson-700 via-crimson-600 to-ink-900 relative overflow-hidden rounded-3xl bg-gradient-to-br p-10 text-white md:p-14">
          <div className="relative max-w-2xl space-y-5">
            <h2 className="font-display text-3xl font-semibold text-balance md:text-5xl">
              {t('landing.cta_title')}
            </h2>
            <p className="text-balance text-white/85">{t('landing.cta_body')}</p>
            <Link
              href={`/${locale}/inscripcio`}
              className="text-crimson-700 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold transition-transform hover:scale-105"
            >
              {t('landing.registration_open_cta')}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto max-w-6xl border-t border-white/10 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/55">
          <p>
            {t('footer.organized_by')} · {t('footer.edition')}
          </p>
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/privacitat`} className="hover:text-white">
              {t('footer.privacy')}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-white">
              {t('footer.cookies')}
            </Link>
            <Link href={`/${locale}/avis-legal`} className="hover:text-white">
              {t('footer.legal')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  href,
  children,
  compact = false,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white ${
        compact ? 'px-2.5 text-xs uppercase' : ''
      }`}
    >
      {children}
    </Link>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-ink-950/70 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white">
      {icon}
      {children}
    </div>
  );
}

function InfoCard({
  eyebrow,
  title,
  body,
  icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card hover:border-crimson-400/40 group rounded-2xl p-6 transition-colors">
      <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-11 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="text-crimson-400 text-[10px] font-medium tracking-widest uppercase">
        {eyebrow}
      </p>
      <h3 className="font-display mt-1 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/65">{body}</p>
    </div>
  );
}
