'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setPin } from '@/app/[locale]/captain/auth/actions';

type Props = {
  next: string;
  defaultLabel?: string;
};

export function SetupPinForm({ next, defaultLabel }: Props) {
  const t = useTranslations('auth');
  const [pin, setPinValue] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [label, setLabel] = useState(defaultLabel ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError(t('pin_too_short'));
      return;
    }
    if (pin !== pinRepeat) {
      setError(t('pin_mismatch'));
      return;
    }
    const fd = new FormData();
    fd.set('pin', pin);
    fd.set('pin_repeat', pinRepeat);
    fd.set('label', label);
    fd.set('next', next);
    startTransition(async () => {
      const result = await setPin(fd);
      if (!result.ok) {
        if (result.error === 'pin_mismatch') setError(t('pin_mismatch'));
        else setError(t('pin_too_short'));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="pin" className="text-sm font-medium text-white">
          {t('pin_field_label')}
        </label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          pattern="\d{4}"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={isPending}
          required
          className="bg-white/10 text-white placeholder:text-white/40"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="pin_repeat" className="text-sm font-medium text-white">
          {t('pin_field_repeat')}
        </label>
        <Input
          id="pin_repeat"
          name="pin_repeat"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          pattern="\d{4}"
          placeholder="••••"
          value={pinRepeat}
          onChange={(e) => setPinRepeat(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={isPending}
          required
          className="bg-white/10 text-white placeholder:text-white/40"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="label" className="text-sm font-medium text-white">
          {t('pin_field_device_label')}
        </label>
        <Input
          id="label"
          name="label"
          type="text"
          maxLength={64}
          placeholder="iPhone Jonatan"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={isPending}
          className="bg-white/10 text-white placeholder:text-white/40"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '…' : t('pin_save')}
      </Button>
    </form>
  );
}
