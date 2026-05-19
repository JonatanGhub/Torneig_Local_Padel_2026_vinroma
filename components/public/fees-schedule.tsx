import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { formatCents, type PublicFee } from '@/lib/pricing';

type Status = 'past' | 'active' | 'upcoming';

function statusFor(fee: PublicFee, now: number): Status {
  const start = new Date(fee.starts_at).getTime();
  const end = new Date(fee.ends_at).getTime();
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'active';
}

export async function FeesSchedule({
  fees,
  locale,
}: {
  fees: PublicFee[];
  locale: Locale;
}) {
  const t = await getTranslations('fees_schedule');
  if (fees.length === 0) return null;

  const now = Date.now();
  const intlLocale = locale === 'ca' ? 'ca-ES' : 'es-ES';
  const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Madrid',
  });

  return (
    <section className="border-border space-y-3 rounded-md border p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground text-xs">{t('subtitle')}</p>
      </header>
      <ul className="space-y-2">
        {fees.map((fee) => {
          const status = statusFor(fee, now);
          const label = locale === 'ca' ? fee.label_ca : fee.label_es;
          const range = `${dateFormatter.format(new Date(fee.starts_at))} – ${dateFormatter.format(new Date(fee.ends_at))}`;
          return (
            <li
              key={fee.id}
              className={`flex flex-wrap items-baseline justify-between gap-2 rounded-md px-3 py-2 text-sm ${
                status === 'active'
                  ? 'border-primary/30 bg-primary/5 border'
                  : status === 'past'
                    ? 'text-muted-foreground border border-transparent line-through'
                    : 'border-border border'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">{range}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">
                  {formatCents(fee.amount_per_player_cents, locale)}
                </span>
                <span className="text-muted-foreground text-xs">{t('per_player')}</span>
                {status === 'active' && (
                  <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {t('status_active')}
                  </span>
                )}
                {status === 'upcoming' && (
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {t('status_upcoming')}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
