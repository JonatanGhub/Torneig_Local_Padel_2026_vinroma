import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Landmark } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/pricing';
import { CopyButton } from './copy-button';

type Props = {
  params: Promise<{ locale: Locale; reference: string }>;
};

export default async function PaymentPage({ params }: Props) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('payment');

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount_cents, status, reference_code, method, pair_id, fee_id')
    .eq('reference_code', reference)
    .maybeSingle();

  if (!payment) notFound();

  const [{ data: pair }, { data: fee }, { data: settings }] = await Promise.all([
    supabase
      .from('pairs')
      .select('id, status, category_id, captain_id')
      .eq('id', payment.pair_id)
      .maybeSingle(),
    supabase
      .from('tournament_fees')
      .select('label_ca, label_es')
      .eq('id', payment.fee_id)
      .maybeSingle(),
    supabase.from('club_settings').select('legal_name, iban, email').maybeSingle(),
  ]);

  const isPaid = payment.status === 'paid';
  const isPairConfirmed = pair?.status === 'confirmed';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('back_home')}
      </Link>

      {isPaid ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-semibold">{t('paid_title')}</h1>
              <p className="text-muted-foreground text-sm">
                {isPairConfirmed ? t('pair_confirmed') : t('pair_partial')}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">{t('pending_title')}</h1>
            <p className="text-muted-foreground text-sm">{t('pending_subtitle')}</p>
          </header>

          <div className="border-border space-y-2 rounded-md border p-4">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              {t('amount_label')}
            </p>
            <p className="text-3xl font-bold">{formatCents(payment.amount_cents, locale)}</p>
            <p className="text-muted-foreground text-xs">
              {fee ? (locale === 'ca' ? fee.label_ca : fee.label_es) : ''}
            </p>
          </div>

          <div className="border-border space-y-3 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Landmark className="size-4" />
              <h2 className="font-medium">{t('transfer_title')}</h2>
            </div>
            <p className="text-muted-foreground text-xs">{t('transfer_subtitle')}</p>
            {settings?.iban ? (
              <div className="flex items-center justify-between rounded bg-[hsl(var(--secondary))] px-3 py-2 font-mono text-sm">
                <span>{settings.iban}</span>
                <CopyButton value={settings.iban} />
              </div>
            ) : (
              <p className="text-destructive text-xs">{t('iban_not_configured')}</p>
            )}
          </div>

          <div className="border-border space-y-2 rounded-md border-2 border-dashed p-4">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              {t('concept_label')}
            </p>
            <div className="flex items-center justify-between rounded bg-[hsl(var(--secondary))] px-3 py-2 font-mono text-sm">
              <span>{payment.reference_code}</span>
              <CopyButton value={payment.reference_code} />
            </div>
            <p className="text-destructive text-xs">
              <strong>{t('concept_warning_title')}:</strong> {t('concept_warning_body')}
            </p>
          </div>

          <p className="text-muted-foreground text-xs">
            {t('confirmation_note', { email: settings?.email ?? 'clubpadelvinroma@gmail.com' })}
          </p>
        </section>
      )}
    </main>
  );
}
