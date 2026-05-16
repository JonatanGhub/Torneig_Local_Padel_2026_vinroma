'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { deleteFinanceEntry } from './actions';

export function DeleteButton({ entryId }: { entryId: string }) {
  const t = useTranslations('finance');
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(t('confirm_delete'))) return;
    const fd = new FormData();
    fd.set('entryId', entryId);
    startTransition(async () => {
      await deleteFinanceEntry(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-label={t('delete')}
      className="hover:text-destructive inline-flex size-7 items-center justify-center rounded-md text-white/45 transition-colors"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
