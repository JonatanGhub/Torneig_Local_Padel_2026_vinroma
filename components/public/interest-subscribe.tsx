'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check } from 'lucide-react';
import type { Locale } from '@/i18n';
import { subscribeInterest } from '@/app/actions/interest';

type Status = 'idle' | 'success' | 'already' | 'error';

export function InterestSubscribe({ locale, source }: { locale: Locale; source?: string }) {
  const t = useTranslations('interest');
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('locale', locale);
    if (source) formData.set('source', source);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await subscribeInterest(formData);
      if (result.ok) {
        setStatus(result.alreadySubscribed ? 'already' : 'success');
      } else {
        setStatus('error');
        setErrorMessage(result.error === 'invalid_email' ? t('error_invalid') : t('error_generic'));
      }
    });
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm text-white">
        <Check className="text-crimson-300 size-4" />
        <p>{status === 'already' ? t('already_subscribed') : t('thanks')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder={t('email_placeholder')}
          className="focus:border-crimson-400 focus:ring-crimson-400/40 flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder-white/45 focus:ring-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {isPending ? t('submitting') : t('subscribe_cta')}
          {!isPending && <ArrowRight className="size-4" />}
        </button>
      </div>
      <p className="text-xs text-white/55">{t('disclaimer')}</p>
      {errorMessage && <p className="text-crimson-300 text-xs">{errorMessage}</p>}
    </form>
  );
}
