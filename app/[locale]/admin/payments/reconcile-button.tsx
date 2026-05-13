'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { reconcilePayment } from './actions';

export function ReconcileButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      setError(null);
      const result = await reconcilePayment(paymentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) return <span className="text-xs text-green-600">{t('reconciled_ok')}</span>;
  return (
    <div className="space-y-1">
      <Button size="sm" onClick={handleClick} disabled={isPending} type="button">
        {isPending ? '…' : t('reconcile_action')}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
