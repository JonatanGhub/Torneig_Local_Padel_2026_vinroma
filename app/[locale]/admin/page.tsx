import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminDashboard({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const [{ count: pairsCount }, { count: pendingCount }, { count: confirmedCount }] =
    await Promise.all([
      supabase.from('pairs').select('id', { count: 'exact', head: true }),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('pairs').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard_title')}</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label={t('stat_pairs_total')} value={pairsCount ?? 0} />
        <StatCard label={t('stat_payments_pending')} value={pendingCount ?? 0} />
        <StatCard label={t('stat_pairs_confirmed')} value={confirmedCount ?? 0} />
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-md border p-4">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
