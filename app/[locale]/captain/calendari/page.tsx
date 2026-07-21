import Link from 'next/link';
import { headers } from 'next/headers';
import { CalendarClock } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { MatchCard } from '@/components/match/match-card';
import { loadCaptainContext } from '@/lib/captain/data';
import { matchCardPhase } from '@/lib/phase-label';
import { getSiteHost } from '@/lib/site-url';
import { NoProfilePanel } from '../no-profile-panel';
import { CalendarSubscriptionCard } from '../calendar-subscription';
import { CaptainCalendarViews, type CalendarMatchView } from './calendar-views';

type Props = { params: Promise<{ locale: Locale }> };

const DAY_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Europe/Madrid',
});

export default async function CaptainCalendariPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ctx = await loadCaptainContext(locale);
  if (!ctx.player) return <NoProfilePanel locale={locale} />;

  const { player, myPairIds, matches, pairLabels, categoryLabels, categoryLevels } = ctx;

  const calendarMatches: CalendarMatchView[] = matches
    .filter((m) => m.scheduled_at)
    .map((m) => {
      const mySide: 'a' | 'b' = myPairIds.includes(m.pair_a_id) ? 'a' : 'b';
      const dayKey = DAY_KEY_FMT.format(new Date(m.scheduled_at!));
      return {
        id: m.id,
        scheduledAtISO: m.scheduled_at!,
        dayKey,
        card: (
          <MatchCard
            category={categoryLabels.get(m.category_id) ?? ''}
            groupLabel={m.group_label}
            phase={matchCardPhase(m.phase, categoryLevels.get(m.category_id))}
            pairALabel={pairLabels.get(m.pair_a_id) ?? '—'}
            pairBLabel={pairLabels.get(m.pair_b_id) ?? '—'}
            scheduledAt={m.scheduled_at}
            courtLabel={m.court_label}
            status={m.status}
            myPairSide={mySide}
            locale={locale}
          />
        ),
      };
    });

  // Build the calendar feed URL — same recipe as the captain home.
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? getSiteHost();
  const proto =
    requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const feedPath = `/api/captain/calendar/${player.calendar_feed_token}?lang=${locale}`;
  const feedUrl = host ? `${proto}://${host}${feedPath}` : feedPath;
  const webcalUrl = host ? `webcal://${host}${feedPath}` : feedPath;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
          {t('captain.tab_calendar')}
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {t('captain.calendar_page_title')}
        </h1>
        <p className="mt-2 text-sm text-white/65">{t('captain.calendar_page_subtitle')}</p>
      </header>

      {calendarMatches.length === 0 ? (
        <EmptyState title={t('captain.no_matches')} body={t('captain.no_matches_body')} />
      ) : (
        <CaptainCalendarViews
          locale={locale}
          matches={calendarMatches}
          labels={{
            list: t('captain.calendar_view_list'),
            week: t('captain.calendar_view_week'),
            previous_week: t('captain.calendar_prev_week'),
            next_week: t('captain.calendar_next_week'),
            today: t('captain.calendar_today'),
            empty: t('captain.calendar_day_empty'),
          }}
        />
      )}

      <div className="mt-12">
        <CalendarSubscriptionCard feedUrl={feedUrl} webcalUrl={webcalUrl} />
      </div>

      <p className="mt-6 text-center text-xs text-white/45">
        <Link href={`/${locale}/captain`} className="hover:text-white">
          {t('captain.back_to_home')}
        </Link>
      </p>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
      <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
        <CalendarClock className="size-6" />
      </div>
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/55">{body}</p>
    </div>
  );
}
