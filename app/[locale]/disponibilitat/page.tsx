import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import {
  OFFICIAL_TIMES,
  OFFICIAL_COURTS,
  SUMMER_OFFSET,
  GROUP_PHASE_LAST_DAY,
  officialDaysMonToThu,
  buildOccupiedSlots,
} from '@/lib/scheduling/official-slots';

type Props = { params: Promise<{ locale: Locale }> };

export default async function DisponibilitatPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  const { data: scheduled } = await supabase
    .from('matches')
    .select('scheduled_at, court_label')
    .eq('tournament_id', tournament?.id ?? '')
    .not('scheduled_at', 'is', null);

  const occupied = buildOccupiedSlots(scheduled ?? []);

  const days = officialDaysMonToThu(
    new Date().toISOString(),
    `${GROUP_PHASE_LAST_DAY}T23:59:59${SUMMER_OFFSET}`,
  );

  const dayFormatter = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">{t('availability.title')}</h1>
      <p className="text-muted-foreground mb-6 text-sm">{t('availability.subtitle')}</p>

      {days.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('availability.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[hsl(var(--border))]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left">
                <th className="p-3 font-medium">{t('availability.day_col')}</th>
                {OFFICIAL_TIMES.flatMap((time) =>
                  OFFICIAL_COURTS.map((court) => (
                    <th key={`${time}-${court}`} className="p-3 font-medium whitespace-nowrap">
                      {time} · {court}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {days.map((day) => (
                <tr key={day}>
                  <td className="p-3 font-medium whitespace-nowrap capitalize">
                    {dayFormatter.format(new Date(`${day}T12:00:00Z`))}
                  </td>
                  {OFFICIAL_TIMES.flatMap((time) =>
                    OFFICIAL_COURTS.map((court) => {
                      const iso = new Date(`${day}T${time}:00${SUMMER_OFFSET}`).toISOString();
                      const isFree = !occupied.has(`${iso}|${court}`);
                      return (
                        <td key={`${time}-${court}`} className="p-3">
                          <span
                            className={
                              isFree
                                ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400'
                                : 'text-muted-foreground inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-medium'
                            }
                          >
                            {isFree ? t('availability.free') : t('availability.occupied')}
                          </span>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground mt-6 text-xs">{t('availability.footnote')}</p>
    </main>
  );
}
