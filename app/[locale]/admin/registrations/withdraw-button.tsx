'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { adminWithdrawPair } from './withdraw-actions';

export function AdminWithdrawButton({
  pairId,
  locale,
  pairLabel,
}: {
  pairId: string;
  locale: 'ca' | 'es';
  pairLabel: string;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminWithdrawPair({
        pairId,
        reason: reason || undefined,
        locale,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-orange-400/40 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-400/10 dark:text-orange-300"
      >
        {t('registrations_withdraw_cta')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="bg-background w-full max-w-md rounded-lg border border-[hsl(var(--border))] p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold">
              {t('registrations_withdraw_title')}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('registrations_withdraw_confirm', { pair: pairLabel })}
            </p>

            <label className="mt-4 block">
              <span className="text-muted-foreground mb-1 block text-xs">
                {t('registrations_withdraw_reason_label')}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('registrations_withdraw_reason_placeholder')}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              />
            </label>

            {error && (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                {t(
                  `registrations_withdraw_error_${error}` as 'registrations_withdraw_error_pair_not_found',
                )}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--accent))]"
              >
                {t('registrations_withdraw_cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {isPending
                  ? t('registrations_withdraw_saving')
                  : t('registrations_withdraw_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
