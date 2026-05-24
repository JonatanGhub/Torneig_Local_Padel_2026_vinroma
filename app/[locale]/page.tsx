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
import { createClient } from '@/lib/supabase/server';
import { formatCents, getTournamentFees, type PublicFee } from '@/lib/pricing';
import { CourtCarousel } from '@/components/brand/court-carousel';
import { LogoLockup } from '@/components/brand/logo-mark';
import { InterestSubscribe } from '@/components/public/interest-subscribe';
import { LocaleSwitcher } from '@/components/locale-switcher';

type Props = { params: Promise<{ locale: Locale }> };

const SLIDES = [
  { src: '/images/courts/1.png', alt: 'Pistes de pàdel — Les Coves de Vinromà' },
  { src: '/images/courts/2.png', alt: 'Pista exterior amb vallat — Les Coves de Vinromà' },
  { src: '/images/courts/3.png', alt: 'Pistes de pàdel al capvespre — Les Coves de Vinromà' },
];

const KEY_DATE_FIELDS: Array<{
  icon: typeof Calendar;
  labelKey: 'date_opens' | 'date_close' | 'date_draw' | 'date_first_match' | 'date_final';
  field:
    | 'registration_opens_at'
    | 'registration_closes_at'
    | 'draw_at'
    | 'first_match_at'
    | 'final_at';
}> = [
  { icon: Calendar, labelKey: 'date_opens', field: 'registration_opens_at' },
  { icon: CalendarClock, labelKey: 'date_close', field: 'registration_closes_at' },
  { icon: Sparkles, labelKey: 'date_draw', field: 'draw_at' },
  { icon: CalendarCheck, labelKey: 'date_first_match', field: 'first_match_at' },
  { icon: Trophy, labelKey: 'date_final', field: 'final_at' },
];

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select(
      'id, registration_opens_at, registration_closes_at, draw_at, first_match_at, final_at, is_published',
    )
    .eq('edition', 5)
    .maybeSingle();
  const fees = tournament ? await getTournamentFees(supabase, tournament.id) : [];

  const intlLocale = locale === 'ca' ? 'ca-ES' : 'es-ES';
  const shortDateFormatter = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  });
  const longDateFormatter = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'long',
    timeZone: 'Europe/Madrid',
  });

  const now = Date.now();
  const opensAt = tournament ? new Date(tournament.registration_opens_at).getTime() : null;
  const closesAt = tournament ? new Date(tournament.registration_closes_at).getTime() : null;
  const isPublished = tournament?.is_published === true;
  const beforeOpen = opensAt !== null && now < opensAt;
  const afterClose = closesAt !== null && now > closesAt;
  const registrationOpen = isPublished && !beforeOpen && !afterClose;

  const keyDates = KEY_DATE_FIELDS.map((step) => ({
    ...step,
    formatted: tournament ? shortDateFormatter.format(new Date(tournament[step.field])) : null,
  }));

  const heroCaption = tournament
    ? afterClose
      ? t('landing.registration_closed_caption')
      : beforeOpen
        ? t('landing.registration_opens_caption', {
            date: longDateFormatter.format(new Date(tournament.registration_opens_at)),
          })
        : t('landing.registration_closes_caption', {
            date: longDateFormatter.format(new Date(tournament.registration_closes_at)),
          })
    : null;

  const registrationCtaLabel = afterClose
    ? t('landing.registration_closed_cta')
    : beforeOpen
      ? t('landing.registration_opens_soon_cta')
      : t('landing.registration_open_cta');

  const relevantFee = pickRelevantFee(fees, now);
  const pricingCard = buildPricingCard(relevantFee, locale, t, shortDateFormatter);

  return (
    <div className="bg-ink-950 relative min-h-screen overflow-hidden text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="sticky top-4 z-40 mx-auto flex max-w-6xl items-center justify-between px-4">
        <div className="liquid-glass-dark flex w-full items-center justify-between rounded-full px-4 py-2.5 sm:px-5">
          <LogoLockup />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <NavLink href={`/${locale}/grups`}>{t('navigation.groups')}</NavLink>
            <NavLink href={`/${locale}/quadre`}>{t('navigation.knockout')}</NavLink>
            <NavLink href={`/${locale}/calendari`}>{t('navigation.calendar')}</NavLink>
            <LocaleSwitcher current={locale} className="ml-1" />
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
            {registrationOpen ? (
              <Link
                href={`/${locale}/inscripcio`}
                className="glow-crimson bg-crimson-600 hover:bg-crimson-500 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
              >
                {registrationCtaLabel}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
            <Link
              href={`/${locale}/grups`}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              {t('landing.see_groups_cta')}
            </Link>
          </div>

          {heroCaption && <p className="text-xs text-white/55">{heroCaption}</p>}

          {beforeOpen && (
            <div className="border-crimson-500/20 max-w-md space-y-3 rounded-2xl border bg-white/5 p-5">
              <p className="text-sm font-medium text-white">{t('interest.title')}</p>
              <p className="text-xs text-white/65">{t('interest.subtitle')}</p>
              <InterestSubscribe locale={locale} source="landing_hero" />
            </div>
          )}
        </div>

        <div className="relative aspect-[4/3] w-full">
          <CourtCarousel
            slides={SLIDES}
            className="relative h-full w-full rounded-3xl border border-white/10 shadow-2xl"
          />

          <div className="absolute top-5 left-5 z-10 space-y-2">
            <Chip icon={<Trophy className="size-3.5" />}>
              {t('landing.stat_categories', { count: 4 })}
            </Chip>
            <Chip icon={<Users className="size-3.5" />}>
              {t('landing.stat_pairs', { count: 32 })}
            </Chip>
            <Chip icon={<MapPin className="size-3.5" />}>{t('landing.stat_courts')}</Chip>
            <Chip icon={<CalendarClock className="size-3.5" />}>{t('landing.stat_schedule')}</Chip>
          </div>
        </div>
      </section>

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
          {keyDates.map((step) => {
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
                  {step.formatted ?? '—'}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

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
          title={pricingCard.title}
          body={pricingCard.body}
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="border-crimson-500/20 flex items-center justify-center gap-3 rounded-2xl border bg-white/5 px-6 py-5 text-center">
          <CalendarClock className="text-crimson-400 size-5 shrink-0" />
          <p className="text-sm text-white/85 md:text-base">{t('landing.schedule')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="from-crimson-700 via-crimson-600 to-ink-900 relative overflow-hidden rounded-3xl bg-gradient-to-br p-10 text-white md:p-14">
          <div className="relative max-w-2xl space-y-5">
            <h2 className="font-display text-3xl font-semibold text-balance md:text-5xl">
              {t('landing.cta_title')}
            </h2>
            <p className="text-balance text-white/85">{t('landing.cta_body')}</p>
            {registrationOpen ? (
              <Link
                href={`/${locale}/inscripcio`}
                className="text-crimson-700 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold transition-transform hover:scale-105"
              >
                {registrationCtaLabel}
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white/70 px-7 py-3 text-sm font-semibold text-white/90"
              >
                {registrationCtaLabel}
              </span>
            )}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-white/10 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/55">
          <p>
            {t('footer.organized_by')} · {t('footer.edition')}
          </p>
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/sponsors`} className="hover:text-white">
              {t('navigation.sponsors')}
            </Link>
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

function pickRelevantFee(
  fees: PublicFee[],
  now: number,
): { fee: PublicFee; kind: 'active' | 'upcoming' | 'past' } | null {
  const active = fees.find((f) => {
    const s = new Date(f.starts_at).getTime();
    const e = new Date(f.ends_at).getTime();
    return now >= s && now <= e;
  });
  if (active) return { fee: active, kind: 'active' };

  const upcoming = fees.find((f) => new Date(f.starts_at).getTime() > now);
  if (upcoming) return { fee: upcoming, kind: 'upcoming' };

  const past = [...fees].reverse().find((f) => new Date(f.ends_at).getTime() < now);
  if (past) return { fee: past, kind: 'past' };
  return null;
}

function buildPricingCard(
  preview: ReturnType<typeof pickRelevantFee>,
  locale: Locale,
  t: (key: string, values?: Record<string, string | number>) => string,
  shortDateFormatter: Intl.DateTimeFormat,
): { title: string; body: string } {
  if (!preview) {
    return {
      title: t('landing.card_pricing_title'),
      body: t('landing.card_pricing_body'),
    };
  }
  const { fee, kind } = preview;
  const label = locale === 'ca' ? fee.label_ca : fee.label_es;
  const amount = formatCents(fee.amount_per_player_cents, locale);
  if (kind === 'active') {
    return {
      title: label,
      body: t('landing.card_pricing_active', {
        amount,
        date: shortDateFormatter.format(new Date(fee.ends_at)),
      }),
    };
  }
  if (kind === 'upcoming') {
    return {
      title: label,
      body: t('landing.card_pricing_upcoming', {
        amount,
        date: shortDateFormatter.format(new Date(fee.starts_at)),
      }),
    };
  }
  return {
    title: label,
    body: t('landing.card_pricing_past', { amount }),
  };
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
