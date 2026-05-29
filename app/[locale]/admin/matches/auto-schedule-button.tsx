'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { autoScheduleGroupMatches } from './actions';

export function AutoScheduleButton() {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'warn' | 'error'>('ok');

  function run() {
    if (!window.confirm(t('autoschedule_confirm'))) return;
    setMessage(null);
    startTransition(async () => {
      const res = await autoScheduleGroupMatches();
      if (!res.ok) {
        setTone('error');
        if (res.error === 'dates_not_set') setMessage(t('autoschedule_error_dates'));
        else if (res.error === 'no_match_days') setMessage(t('autoschedule_error_no_days'));
        else if (res.error === 'nothing_to_schedule') setMessage(t('autoschedule_error_nothing'));
        else setMessage(res.error);
        return;
      }
      if (res.unplaced > 0) {
        setTone('warn');
        setMessage(t('autoschedule_partial', { assigned: res.assigned, unplaced: res.unplaced }));
      } else {
        setTone('ok');
        setMessage(t('autoschedule_ok', { assigned: res.assigned }));
      }
    });
  }

  const toneClass =
    tone === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-destructive';

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={run} disabled={isPending} type="button">
        <CalendarCog className="mr-1.5 size-4" />
        {isPending ? t('autoschedule_running') : t('autoschedule_cta')}
      </Button>
      {message && <span className={`max-w-xs text-right text-xs ${toneClass}`}>{message}</span>}
    </div>
  );
}
