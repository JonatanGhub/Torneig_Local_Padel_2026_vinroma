'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCategoryMaxPairs } from './actions';

type Category = {
  id: string;
  level: number;
  label: string;
  maxPairs: number;
  usedPairs: number;
};

export function CategoryCapacityForm({ categories }: { categories: Category[] }) {
  const t = useTranslations('admin');

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('categories_capacity_title')}</h2>
        <p className="text-muted-foreground text-sm">{t('categories_capacity_subtitle')}</p>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-xs uppercase">
            <th className="py-2 text-left font-medium">{t('categories_capacity_col_category')}</th>
            <th className="py-2 text-right font-medium">{t('categories_capacity_col_enrolled')}</th>
            <th className="py-2 text-right font-medium">{t('categories_capacity_col_max')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <CategoryRow key={cat.id} category={cat} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [maxPairs, setMaxPairs] = useState(category.maxPairs);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isFull = category.usedPairs >= maxPairs;

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateCategoryMaxPairs(category.id, maxPairs);
      setFeedback(
        result.ok
          ? t('categories_capacity_saved')
          : `${t('categories_capacity_error')}: ${result.error}`,
      );
    });
  }

  return (
    <tr className="border-border border-b last:border-0">
      <td className="py-3">
        <span className="font-medium">{category.label}</span>
        {isFull && (
          <span className="text-destructive ml-2 text-xs">{t('categories_capacity_full')}</span>
        )}
      </td>
      <td className="py-3 text-right tabular-nums">{category.usedPairs}</td>
      <td className="py-3 pr-2 text-right">
        <Input
          type="number"
          min={1}
          value={maxPairs}
          onChange={(e) => setMaxPairs(Number(e.target.value))}
          className="ml-auto w-20 text-right"
        />
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? '…' : t('categories_capacity_save')}
          </Button>
          {feedback && <span className="text-muted-foreground text-xs">{feedback}</span>}
        </div>
      </td>
    </tr>
  );
}
