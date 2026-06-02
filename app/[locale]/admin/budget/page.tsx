import { TrendingUp, TrendingDown, Wallet, PartyPopper } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { BudgetForm } from './budget-form';
import { EntryRow, type BudgetEntry } from './entry-row';

type Props = { params: Promise<{ locale: Locale }> };

export default async function BudgetAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  if (!tournament) {
    return <p className="text-muted-foreground text-sm">{t('budget_no_tournament')}</p>;
  }

  const [paymentsResp, entriesResp] = await Promise.all([
    supabase.from('payments').select('amount_cents, status').eq('status', 'paid'),
    supabase
      .from('tournament_budget_entries')
      .select('id, kind, category, label, amount_cents, occurred_on, notes')
      .eq('tournament_id', tournament.id)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  const inscriptionsIncome = (paymentsResp.data ?? []).reduce(
    (acc, p) => acc + (p.amount_cents ?? 0),
    0,
  );
  const entries = (entriesResp.data ?? []) as BudgetEntry[];
  const extraIncome = entries
    .filter((e) => e.kind === 'income')
    .reduce((a, e) => a + e.amount_cents, 0);
  const totalExpense = entries
    .filter((e) => e.kind === 'expense')
    .reduce((a, e) => a + e.amount_cents, 0);
  const snacksSpent = entries
    .filter((e) => e.kind === 'expense' && e.category === 'snacks')
    .reduce((a, e) => a + e.amount_cents, 0);
  const totalIncome = inscriptionsIncome + extraIncome;
  const balance = totalIncome - totalExpense;
  const nonSnackExpense = totalExpense - snacksSpent;
  const snacksBudget = Math.max(0, totalIncome - nonSnackExpense);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">{t('budget_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('budget_subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          tone="income"
          icon={<TrendingUp className="size-4" />}
          label={t('budget_total_income')}
          value={formatEur(totalIncome, locale)}
          hint={t('budget_income_hint', {
            inscriptions: formatEur(inscriptionsIncome, locale),
            extra: formatEur(extraIncome, locale),
          })}
        />
        <StatCard
          tone="expense"
          icon={<TrendingDown className="size-4" />}
          label={t('budget_total_expense')}
          value={formatEur(totalExpense, locale)}
        />
        <StatCard
          tone="balance"
          icon={<Wallet className="size-4" />}
          label={t('budget_balance')}
          value={formatEur(balance, locale)}
        />
        <StatCard
          tone="snacks"
          icon={<PartyPopper className="size-4" />}
          label={t('budget_snacks_available')}
          value={formatEur(snacksBudget, locale)}
          hint={t('budget_snacks_hint', { spent: formatEur(snacksSpent, locale) })}
        />
      </div>

      <BudgetForm tournamentId={tournament.id} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('budget_entries_title')}</h2>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">{t('budget_no_entries')}</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} locale={locale} />
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs italic">
          {t('budget_auto_inscriptions_hint', {
            count: paymentsResp.data?.length ?? 0,
            amount: formatEur(inscriptionsIncome, locale),
          })}
        </p>
      </section>
    </section>
  );
}

function StatCard({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: 'income' | 'expense' | 'balance' | 'snacks';
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  const toneClass =
    tone === 'income'
      ? 'border-emerald-400/40 bg-emerald-400/5'
      : tone === 'expense'
        ? 'border-red-400/40 bg-red-400/5'
        : tone === 'snacks'
          ? 'border-amber-400/40 bg-amber-400/5'
          : 'border-border bg-card';
  const valueClass =
    tone === 'income'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'expense'
        ? 'text-red-700 dark:text-red-300'
        : tone === 'snacks'
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-foreground';

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        {icon}
        <span className="text-[10px] font-semibold tracking-widest uppercase">{label}</span>
      </div>
      <p className={`font-display text-2xl font-bold ${valueClass}`}>{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>}
    </div>
  );
}

function formatEur(cents: number, locale: 'ca' | 'es'): string {
  return (cents / 100).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  });
}
