'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginWithPin } from './actions';

const pinSchema = z.string().regex(/^\d{4}$/);

export function PinLoginForm({
  playerFirstName,
  locale,
  next,
}: {
  playerFirstName: string | null;
  locale: 'ca' | 'es';
  next: string | null;
}) {
  const t = useTranslations('auth');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = pinSchema.safeParse(pin);
    if (!parsed.success) {
      setError(t('pin_too_short'));
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('pin', parsed.data);
      if (next) fd.set('next', next);
      const res = await loginWithPin(fd);
      if (!res.ok) {
        if (res.error === 'unlock_wrong_pin') setError(t('unlock_wrong_pin'));
        else if (res.error === 'unlock_new_device') setError(t('unlock_new_device_warning'));
        else if (res.error === 'no_pin_configured') setError(t('pin_too_short'));
        else setError(t('unlock_wrong_pin'));
      }
    });
  }

  // L'enllaç per canviar a email afegeix ?mode=email i no envia el device cookie
  // al servidor (només canvia la vista). El page.tsx el detecta.
  const switchToEmailHref = `/${locale}/login?mode=email${next ? `&next=${encodeURIComponent(next)}` : ''}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <p className="text-base">
          {playerFirstName
            ? t.rich('login_pin_welcome', {
                name: playerFirstName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })
            : t('login_pin_welcome_anon')}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{t('login_pin_subtitle')}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="pin" className="text-sm font-medium">
          {t('unlock_enter_pin')}
        </label>
        <Input
          id="pin"
          name="pin"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4}"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={isPending}
          required
          autoFocus
          className="text-center font-mono text-lg tracking-[0.5em]"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending || pin.length !== 4}>
        {isPending ? '…' : t('unlock_button')}
      </Button>

      <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
        <Link href={switchToEmailHref} className="hover:text-foreground underline">
          {t('login_use_email_instead')}
        </Link>
      </div>
    </form>
  );
}
