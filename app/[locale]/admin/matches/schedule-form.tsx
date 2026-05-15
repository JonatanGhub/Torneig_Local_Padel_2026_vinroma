'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { scheduleMatch } from './actions';

export function ScheduleForm({
  matchId,
  scheduledAt,
  courtLabel,
}: {
  matchId: string;
  scheduledAt: string | null;
  courtLabel: string | null;
}) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localAt = scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : '';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await scheduleMatch(fd);
      if (res.ok) setFeedback(t('match_scheduled_ok'));
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 text-xs">
      <input type="hidden" name="matchId" value={matchId} />
      <label className="space-y-1">
        <span className="text-muted-foreground">{t('match_field_scheduled_at')}</span>
        <Input
          type="datetime-local"
          name="scheduledAt"
          defaultValue={localAt}
          required
          className="text-xs"
        />
      </label>
      <label className="space-y-1">
        <span className="text-muted-foreground">{t('match_field_court')}</span>
        <select
          name="courtLabel"
          defaultValue={courtLabel ?? ''}
          required
          className="flex h-10 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-xs"
        >
          <option value="">—</option>
          <option value="Pista 1">Pista 1</option>
          <option value="Pista 2">Pista 2</option>
          <option value="Pista 3">Pista 3</option>
        </select>
      </label>
      <Button size="sm" disabled={isPending} type="submit">
        {isPending ? '…' : t('match_save')}
      </Button>
      {feedback && <span className="text-xs text-green-600">{feedback}</span>}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </form>
  );
}
