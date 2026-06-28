'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarCog, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { proposeAutoSchedule, confirmSchedules } from './actions';
import { useScheduler } from './scheduler-context';

export function AutoScheduleControls() {
  const t = useTranslations('admin');
  const router = useRouter();
  const { proposals, setProposals, clearProposals } = useScheduler();
  const [isProposing, startPropose] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'warn' | 'error'>('ok');

  const proposedCount = Object.keys(proposals).length;

  function propose() {
    setMessage(null);
    startPropose(async () => {
      const res = await proposeAutoSchedule();
      if (!res.ok) {
        setTone('error');
        if (res.error === 'dates_not_set') setMessage(t('autoschedule_error_dates'));
        else if (res.error === 'no_match_days') setMessage(t('autoschedule_error_no_days'));
        else if (res.error === 'nothing_to_schedule') setMessage(t('autoschedule_error_nothing'));
        else setMessage(res.error);
        return;
      }
      const map: Record<string, { scheduledAtInput: string; courtLabel: string }> = {};
      for (const p of res.proposals) {
        map[p.matchId] = { scheduledAtInput: p.scheduledAtInput, courtLabel: p.courtLabel };
      }
      setProposals(map);
      if (res.unplaced > 0) {
        setTone('warn');
        setMessage(
          t('autoschedule_proposed_partial', {
            assigned: res.proposals.length,
            unplaced: res.unplaced,
          }),
        );
      } else {
        setTone('ok');
        setMessage(t('autoschedule_proposed_ok', { assigned: res.proposals.length }));
      }
    });
  }

  function saveAll() {
    if (proposedCount === 0) return;
    if (!window.confirm(t('autoschedule_save_confirm', { count: proposedCount }))) return;
    setMessage(null);
    startSave(async () => {
      const assignments = Object.entries(proposals).map(([matchId, p]) => ({
        matchId,
        scheduledAtInput: p.scheduledAtInput,
        courtLabel: p.courtLabel,
      }));
      const res = await confirmSchedules(assignments);
      if (!res.ok) {
        setTone('error');
        setMessage(res.error === 'invalid_input' ? t('autoschedule_error_invalid') : res.error);
        return;
      }
      if (res.skipped > 0) {
        setTone('warn');
        setMessage(t('autoschedule_saved_partial', { saved: res.saved, skipped: res.skipped }));
      } else {
        setTone('ok');
        setMessage(t('autoschedule_saved_ok', { count: res.saved }));
      }
      clearProposals();
      router.refresh();
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={propose}
          disabled={isProposing || isSaving}
          type="button"
        >
          <CalendarCog className="mr-1.5 size-4" />
          {isProposing ? t('autoschedule_running') : t('autoschedule_cta')}
        </Button>
        {proposedCount > 0 && (
          <>
            <Button size="sm" onClick={saveAll} disabled={isSaving || isProposing} type="button">
              <Check className="mr-1.5 size-4" />
              {isSaving
                ? t('autoschedule_saving')
                : t('autoschedule_save_all', { count: proposedCount })}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearProposals}
              disabled={isSaving || isProposing}
              type="button"
            >
              <X className="mr-1.5 size-4" />
              {t('autoschedule_discard')}
            </Button>
          </>
        )}
      </div>
      {message && <span className={`max-w-md text-right text-xs ${toneClass}`}>{message}</span>}
      {proposedCount > 0 && (
        <span className="text-muted-foreground max-w-md text-right text-[11px]">
          {t('autoschedule_proposed_hint')}
        </span>
      )}
    </div>
  );
}
