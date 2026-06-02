'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { deleteBudgetEntry } from './actions';

export type BudgetEntry = {
  id: string;
  kind: 'income' | 'expense';
  category: string;
  label: string;
  amount_cents: number;
  occurred_on: string;
  notes: string | null;
};

export function EntryRow({ entry, locale }: { entry: BudgetEntry; locale: 'ca' | 'es' }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(t('budget_confirm_delete'))) return;
    const fd = new FormData();
    fd.set('id', entry.id);
    startTransition(async () => {
      await deleteBudgetEntry(fd);
      router.refresh();
    });
  }

  const isIncome = entry.kind === 'income';
  const amount = (entry.amount_cents / 100).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  });
  const date = new Date(`${entry.occurred_on}T12:00:00Z`).toLocaleDateString(
    locale === 'ca' ? 'ca-ES' : 'es-ES',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  return (
    <li className="border-border bg-card flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isIncome
            ? 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-red-400/15 text-red-700 dark:text-red-300'
        }`}
      >
        {isIncome ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.label}</p>
        <p className="text-muted-foreground text-xs">
          {t(`budget_category_${entry.category}` as 'budget_category_snacks')} · {date}
          {entry.notes && ` · ${entry.notes}`}
        </p>
      </div>
      <span
        className={`text-sm font-semibold ${isIncome ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
      >
        {isIncome ? '+' : '−'} {amount}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="text-muted-foreground hover:text-destructive"
        aria-label="delete"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
