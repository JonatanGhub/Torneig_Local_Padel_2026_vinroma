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
import { CourtBackdrop } from '@/components/brand/court-pattern';
import { LogoLockup, LogoMark } from '@/components/brand/logo-mark';

type Props = { params: Promise<{ locale: Locale }> };

const KEY_DATES: Array<{
  icon: typeof Calendar;
  labelKey: 'date_opens' | 'date_close' | 'date_draw' | 'date_first_match' | 'date_final';
  dateCa: string;
  dateEs: string;
}> = [
  { icon: Calendar, labelKey: 'date_opens', dateCa: '1 de juny', dateEs: '1 de junio' },
  { icon: CalendarClock, labelKey: 'date_close', dateCa: '30 de juny', dateEs: '30 de junio' },
  { icon: Sparkles, labelKey: 'date_draw', dateCa: '1 de juliol', dateEs: '1 de julio' },
  { icon: CalendarCheck, labelKey: 'date_first_match', dateCa: '6 de juliol', dateEs: '6 de julio' },
  { icon: Trophy, labelKey: 'date_final', dateCa: "9 d'agost", dateEs: '9 de agosto' },
];

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const otherLocale: Locale = locale === 'ca' ? 'es' : 'ca';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(var(--background))]">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10 opacity-90" />
      <div aria-hidden className="bg-court-400/20 pointer-events-none absolute -top-32 -left-32 -z-10 size-96 rounded-full blur-3xl" style={{ animation: 'floatSlow 8s ease-in-out infinite' }} />
      <div aria-hidden className="bg-clay-400/20 pointer-events-none absolute top-1/2 -right-40 -z-10 size-[28rem] rounded-full blur-3xl" style={{ animation: 'floatSlow 10s ease-in-out infinite reverse' }} />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <LogoLockup />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <NavLink href={`/${locale}/grups`}>{t('navigation.groups')}</NavLink>
          <NavLink href={`/${locale}/calendari`}>{t('navigation.calendar')}</NavLink>
          <NavLink href={`/${otherLocale}`} compact>{otherLocale.toUpperCase()}</NavLink>
          <NavLink href={`/${locale}/login`} variant="ghost">{t('navigation.login')}</NavLink>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-8 pb-24 md:grid-cols-2 md:pt-16">
        <div className="space-y-7" style={{ animation: 'fadeUp 0.8s ease-out' }}>
          <div className="border-court-500/30 text-court-700 dark:text-court-400 dark:bg-court-900/40 inline-flex items-center gap-2 rounded-full border bg-white/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <span className="relative flex size-2">
              <span className="bg-court-500 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-court-500 relative inline-flex size-2 rounded-full" />
            </span>
            {t('landing.hero_subtitle')}
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-balance md:text-7xl">{t('landing.hero_title')}</h1>
          <p className="text-muted-foreground max-w-md text-lg text-balance">{t('landing.hero_tagline')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/${locale}/inscripcio`} className="bg-court-600 hover:bg-court-500 glow-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white">
              {t('landing.registration_open_cta')}
              <ArrowRight className="size-4" />
            </Link>
            <Link href={`/${locale}/grups`} className="text-foreground border-foreground/20 inline-flex items-center gap-2 rounded-full border bg-white/30 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-white/40 dark:hover:bg-white/10">
              {t('landing.see_groups_cta')}
            </Link>
          </div>

          <p className="text-muted-foreground text-xs">{t('landing.registration_opens')}</p>
        </div>

        <div className="relative aspect-[4/3] w-full" style={{ animation: 'fadeIn 1s ease-out' }}>
          <div className="court-lines absolute inset-0 -z-10 rounded-3xl opacity-30" />
          <div className="border-court-500/20 dark:border-court-400/20 relative h-full w-full overflow-hidden rounded-3xl border-2 shadow-2xl shadow-[oklch(0.4_0.18_152/0.25)]">
            <CourtBackdrop className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
            <div className="absolute right-6 bottom-6" style={{ animation: 'floatSlow 5s ease-in-out infinite' }}>
              <LogoMark size={88} />
            </div>
            <div className="absolute top-6 left-6 space-y-2">
              <Chip icon={<Trophy className="size-3" />}>{t('landing.stat_categories', { count: 4 })}</Chip>
              <Chip icon={<Users className="size-3" />}>{t('landing.stat_pairs', { count: 32 })}</Chip>
              <Chip icon={<MapPin className="size-3" />}>{t('landing.stat_courts')}</Chip>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-court-700 dark:text-court-400 text-xs font-medium tracking-widest uppercase">{t('landing.timeline_eyebrow')}</p>
            <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{t('landing.timeline_title')}</h2>
          </div>
          <Link href={`/${locale}/calendari`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            {t('landing.see_full_calendar')}
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <ol className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {KEY_DATES.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.labelKey} className="border-border bg-card group relative overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ animation: `fadeUp 0.6s ease-out ${i * 0.08}s backwards` }}>
                <div aria-hidden className="bg-court-500/0 group-hover:bg-court-500/5 absolute inset-0 transition-colors" />
                <div className="bg-court-100 text-court-700 dark:bg-court-900/50 dark:text-court-400 mb-3 inline-flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">{t(`landing.${step.labelKey}` as 'landing.date_opens')}</p>
                <p className="font-display mt-1 text-xl font-semibold">{locale === 'ca' ? step.dateCa : step.dateEs}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        <InfoCard eyebrow={t('landing.card_venue_eyebrow')} title={t('landing.card_venue_title')} body={t('landing.card_venue_body')} icon={<MapPin className="size-5" />} />
        <InfoCard eyebrow={t('landing.card_format_eyebrow')} title={t('landing.card_format_title')} body={t('landing.card_format_body')} icon={<Trophy className="size-5" />} />
        <InfoCard eyebrow={t('landing.card_pricing_eyebrow')} title={t('landing.card_pricing_title')} body={t('landing.card_pricing_body')} icon={<Sparkles className="size-5" />} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="from-court-700 via-court-600 to-clay-600 relative overflow-hidden rounded-3xl bg-gradient-to-br p-10 text-white md:p-14">
          <div aria-hidden className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 -left-20 size-96 rounded-full bg-black/20 blur-3xl" />
          <div className="relative max-w-2xl space-y-5">
            <h2 className="font-display text-3xl font-semibold text-balance md:text-5xl">{t('landing.cta_title')}</h2>
            <p className="text-balance text-white/85">{t('landing.cta_body')}</p>
            <Link href={`/${locale}/inscripcio`} className="text-court-700 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-medium transition-transform hover:scale-105">
              {t('landing.registration_open_cta')}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-border mx-auto max-w-6xl border-t px-6 py-8 text-center">
        <p className="text-muted-foreground text-xs">{t('footer.organized_by')} · {t('footer.edition')}</p>
      </footer>
    </div>
  );
}

function NavLink({ href, children, variant = 'default', compact = false }: { href: string; children: React.ReactNode; variant?: 'default' | 'ghost'; compact?: boolean }) {
  return (
    <Link href={href} className={`text-muted-foreground hover:text-foreground rounded-full px-4 py-2 transition-colors hover:bg-white/30 dark:hover:bg-white/10 ${variant === 'ghost' ? 'border-foreground/20 ml-1 border bg-white/30 dark:bg-white/5' : ''} ${compact ? 'px-3 text-xs uppercase' : ''}`}>
      {children}
    </Link>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="text-court-900 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-xs font-medium backdrop-blur">
      {icon}
      {children}
    </div>
  );
}

function InfoCard({ eyebrow, title, body, icon }: { eyebrow: string; title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="border-border bg-card/80 group relative overflow-hidden rounded-2xl border p-6 backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-court-100 text-court-700 dark:bg-court-900/50 dark:text-court-400 mb-4 inline-flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="text-court-700 dark:text-court-400 text-[10px] font-medium tracking-widest uppercase">{eyebrow}</p>
      <h3 className="font-display mt-1 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm">{body}</p>
    </div>
  );
}
