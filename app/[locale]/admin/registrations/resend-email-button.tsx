'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { adminResendPaymentEmail } from './resend-email-action';

export function AdminResendEmailButton({
  pairId,
  locale,
}: {
  pairId: string;
  locale: 'ca' | 'es';
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<'ok' | string | null>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await adminResendPaymentEmail({ pairId, locale });
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      setFeedback('ok');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md border border-blue-400/40 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-400/10 disabled:opacity-50 dark:text-blue-300"
      >
        <Mail className="size-3" />
        {isPending ? t('registrations_resend_email_sending') : t('registrations_resend_email_cta')}
      </button>
      {feedback === 'ok' && (
        <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
          {t('registrations_resend_email_ok')}
        </span>
      )}
      {feedback && feedback !== 'ok' && (
        <span className="text-[10px] text-red-700 dark:text-red-300">
          {t(
            `registrations_resend_email_error_${feedback}` as 'registrations_resend_email_error_invalid_input',
          )}
        </span>
      )}
    </div>
  );
}
