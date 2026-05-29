'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyAndUnlock } from '@/app/[locale]/captain/auth/actions';

type Props = {
  locale: 'ca' | 'es';
  next: string;
  isUnknownDevice: boolean;
};

export function UnlockForm({ locale, next, isUnknownDevice }: Props) {
  const t = useTranslations('auth');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError(t('unlock_wrong_pin'));
      return;
    }
    const fd = new FormData();
    fd.set('pin', pin);
    fd.set('next', next);
    startTransition(async () => {
      const result = await verifyAndUnlock(fd);
      if (!result.ok) {
        setError(t('unlock_wrong_pin'));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isUnknownDevice ? (
        <div className="rounded-md bg-amber-900/40 p-3 text-sm text-amber-100">
          {t('unlock_new_device_warning')}
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="pin" className="text-sm font-medium text-white">
          {t('unlock_enter_pin')}
        </label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          pattern="\d{4}"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={isPending || isUnknownDevice}
          required
          className="bg-white/10 text-white placeholder:text-white/40"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isPending || isUnknownDevice}>
        {isPending ? '…' : t('unlock_button')}
      </Button>
      <Link
        href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/captain/setup-pin`)}`}
        className="block text-center text-xs text-white/70 underline hover:text-white"
      >
        {t('unlock_forgot')}
      </Link>
    </form>
  );
}
