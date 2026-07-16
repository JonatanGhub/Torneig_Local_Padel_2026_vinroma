import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import type { Locale } from '@/i18n';

type Props = {
  locale: Locale;
  matchId: string;
  status: 'scheduled' | 'pending_validation' | 'validated' | 'disputed' | 'walkover';
  scheduledAt: string | null;
  t: (key: string) => string;
};

// Botons "reportar/validar resultat" + "proposar reprogramació" per a un
// partit del capità. Extret perquè calia el mateix bloc a l'inici i al
// panell de grup (abans només existia a l'inici).
export function CaptainMatchActions({ locale, matchId, status, scheduledAt, t }: Props) {
  const isPlayed = scheduledAt ? new Date(scheduledAt).getTime() <= Date.now() : false;
  const canReport = isPlayed || status === 'pending_validation' || status === 'disputed';
  const reportCta =
    status === 'pending_validation'
      ? t('captain.review_result')
      : status === 'disputed'
        ? t('captain.disputed')
        : t('captain.report_result');

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      {canReport ? (
        <Link
          href={`/${locale}/captain/matches/${matchId}`}
          className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors"
        >
          {reportCta}
        </Link>
      ) : (
        <span
          title={t('captain.report_locked_until_match')}
          className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/45"
        >
          {reportCta}
        </span>
      )}
      <Link
        href={`/${locale}/captain/matches/${matchId}/reschedule`}
        className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10"
      >
        <CalendarClock className="size-3" />
        {t('captain.propose_reschedule_cta')}
      </Link>
    </div>
  );
}
