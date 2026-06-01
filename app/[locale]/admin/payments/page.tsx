import Link from 'next/link';
import { Download } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/pricing';
import { ReconcileButton } from './reconcile-button';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string }>;
};

const VALID_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'] as const;
type PaymentStatus = (typeof VALID_STATUSES)[number];

function asStatus(value: string | undefined): PaymentStatus {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as PaymentStatus;
  }
  return 'pending';
}

export default async function PaymentsAdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const status = asStatus(sp.status);
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, reference_code, amount_cents, status, method, pair_id, payer_player_id, created_at',
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);

  const payerIds = (payments ?? []).map((p) => p.payer_player_id);
  const { data: payers } = payerIds.length
    ? await supabase.from('players').select('id, first_name, last_name, email').in('id', payerIds)
    : { data: [] };

  const payerMap = new Map(payers?.map((p) => [p.id, p]) ?? []);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('payments_title')}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusFilter
            current={status}
            value="pending"
            label={t('status_pending')}
            locale={locale}
          />
          <StatusFilter current={status} value="paid" label={t('status_paid')} locale={locale} />
          <StatusFilter
            current={status}
            value="cancelled"
            label={t('status_cancelled')}
            locale={locale}
          />
          <Link
            href={`/${locale}/admin/payments/export`}
            className="ml-2 inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 hover:bg-[hsl(var(--accent))]"
          >
            <Download className="size-3" />
            {t('export_csv')}
          </Link>
        </div>
      </header>

      {!payments || payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('payments_empty')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {payments.map((p) => {
            const payer = payerMap.get(p.payer_player_id);
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-mono text-sm">{p.reference_code}</p>
                  <p className="text-muted-foreground text-xs">
                    {payer
                      ? `${payer.first_name ?? ''} ${payer.last_name ?? ''} (${payer.email ?? ''})`
                      : ''}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(p.created_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
                      timeZone: 'Europe/Madrid',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">
                    {formatCents(p.amount_cents, locale)}
                  </span>
                  {p.status === 'pending' && <ReconcileButton paymentId={p.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusFilter({
  current,
  value,
  label,
  locale,
}: {
  current: string;
  value: string;
  label: string;
  locale: Locale;
}) {
  const isActive = current === value;
  return (
    <a
      href={`/${locale}/admin/payments?status=${value}`}
      className={
        isActive
          ? 'rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-[hsl(var(--primary-foreground))]'
          : 'rounded-md border border-[hsl(var(--border))] px-3 py-1'
      }
    >
      {label}
    </a>
  );
}
