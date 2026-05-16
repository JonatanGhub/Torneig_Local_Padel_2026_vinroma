'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addFinanceEntry } from './actions';

export function EntryForm({ pairId }: { pairId: string }) {
  const t = useTranslations('finance');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addFinanceEntry(formData);
      if (!res.ok) setError(t(`error_${res.error}` as 'error_invalid_input'));
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
      >
        <Plus className="size-4" />
        {t('add_entry_cta')}
      </button>
    );
  }

  return (
    <form action={onSubmit} className="glass-card space-y-3 rounded-2xl p-4 text-sm">
      <input type="hidden" name="pairId" value={pairId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-white/55">{t('field_kind')}</span>
          <select
            name="kind"
            defaultValue="expense"
            required
            className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-sm"
          >
            <option value="income">{t('kind_income')}</option>
            <option value="expense">{t('kind_expense')}</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-white/55">{t('field_amount')}</span>
          <Input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            placeholder="12,50"
            pattern="^\d+([.,]\d{1,2})?$"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-white/55">{t('field_label')}</span>
        <Input
          type="text"
          name="label"
          required
          maxLength={120}
          placeholder={t('label_placeholder')}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-white/55">{t('field_date')}</span>
          <Input type="date" name="occurredOn" required defaultValue={today} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-white/55">{t('field_notes')}</span>
          <Input type="text" name="notes" maxLength={500} placeholder={t('notes_placeholder')} />
        </label>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          <Send className="mr-1 size-4" />
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
