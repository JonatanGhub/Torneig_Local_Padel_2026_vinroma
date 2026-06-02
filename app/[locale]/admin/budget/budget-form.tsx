'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBudgetEntry } from './actions';

const INCOME_CATEGORIES = ['sponsorship', 'donation', 'other_income'] as const;
const EXPENSE_CATEGORIES = [
  'prizes',
  'snacks',
  'venue',
  'materials',
  'services',
  'other_expense',
] as const;

export function BudgetForm({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const fd = new FormData(e.currentTarget);
    fd.set('tournamentId', tournamentId);
    startTransition(async () => {
      const res = await createBudgetEntry(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFeedback(t('budget_added'));
      setResetKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <form
      key={resetKey}
      onSubmit={handleSubmit}
      className="border-border bg-card space-y-4 rounded-md border p-4"
    >
      <h2 className="text-base font-semibold">{t('budget_add_title')}</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind('income')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            kind === 'income'
              ? 'border-emerald-400 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border text-muted-foreground'
          }`}
        >
          + {t('budget_kind_income')}
        </button>
        <button
          type="button"
          onClick={() => setKind('expense')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            kind === 'expense'
              ? 'border-red-400 bg-red-400/10 text-red-700 dark:text-red-300'
              : 'border-border text-muted-foreground'
          }`}
        >
          − {t('budget_kind_expense')}
        </button>
      </div>
      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('budget_field_category')}</span>
          <select
            name="category"
            required
            defaultValue={categories[0]}
            className="bg-background border-input mt-1 h-10 w-full rounded-md border px-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`budget_category_${c}` as 'budget_category_snacks')}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('budget_field_amount')}</span>
          <Input
            name="amount_eur"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0,00"
            className="mt-1 text-sm"
          />
        </label>

        <label className="space-y-1 text-xs md:col-span-2">
          <span className="text-muted-foreground">{t('budget_field_label')}</span>
          <Input name="label" type="text" required maxLength={200} className="mt-1 text-sm" />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('budget_field_date')}</span>
          <Input
            name="occurred_on"
            type="date"
            defaultValue={today}
            required
            className="mt-1 text-sm"
          />
        </label>

        <label className="space-y-1 text-xs md:col-span-2">
          <span className="text-muted-foreground">{t('budget_field_notes')}</span>
          <textarea
            name="notes"
            rows={2}
            maxLength={1000}
            className="bg-background border-input mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}
      {feedback && <p className="text-xs text-green-600">{feedback}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <Plus className="mr-1 size-3.5" />
          {isPending ? '…' : t('budget_submit')}
        </Button>
      </div>
    </form>
  );
}
