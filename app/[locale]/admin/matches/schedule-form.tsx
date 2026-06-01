'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toMadridInputValue } from '@/lib/format-date';
import { scheduleMatch } from './actions';
import { useScheduler } from './scheduler-context';

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
  const { proposals } = useScheduler();
  const proposal = proposals[matchId];
  const proposedAt = proposal?.scheduledAtInput;
  const proposedCourt = proposal?.courtLabel;

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hora de paret de Madrid per al <input datetime-local> (no UTC!).
  const savedAt = toMadridInputValue(scheduledAt);
  const [at, setAt] = useState(savedAt);
  const [court, setCourt] = useState(courtLabel ?? '');

  // Quan arriba una proposta automàtica, omple els camps perquè l'admin la
  // revisi i la desi. No es desa res fins que prem "Desar".
  useEffect(() => {
    if (proposedAt !== undefined && proposedCourt !== undefined) {
      setAt(proposedAt);
      setCourt(proposedCourt);
    }
  }, [proposedAt, proposedCourt]);

  const isProposed = Boolean(proposal);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setWarning(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await scheduleMatch(fd);
      if (!res.ok) {
        if (res.error === 'pair_double_booked') {
          setError(t('match_error_pair_double_booked'));
        } else if (res.error === 'court_double_booked') {
          setError(t('match_error_court_double_booked'));
        } else {
          setError(res.error);
        }
        return;
      }
      setFeedback(t('match_scheduled_ok'));
      if (res.warning === 'same_time_other_match') {
        setWarning(t('match_warning_same_time'));
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-wrap items-end gap-2 rounded-md text-xs ${
        isProposed ? 'bg-primary/5 -mx-2 px-2 py-2 ring-1 ring-[hsl(var(--primary))]/30' : ''
      }`}
    >
      <input type="hidden" name="matchId" value={matchId} />
      <label className="space-y-1">
        <span className="text-muted-foreground">{t('match_field_scheduled_at')}</span>
        <Input
          type="datetime-local"
          name="scheduledAt"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          required
          className="text-xs"
        />
      </label>
      <label className="space-y-1">
        <span className="text-muted-foreground">{t('match_field_court')}</span>
        <select
          name="courtLabel"
          value={court}
          onChange={(e) => setCourt(e.target.value)}
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
      {isProposed && !feedback && (
        <span className="text-primary text-xs">{t('autoschedule_proposed_badge')}</span>
      )}
      {feedback && <span className="text-xs text-green-600">{feedback}</span>}
      {warning && <span className="text-xs text-amber-600 dark:text-amber-400">⚠ {warning}</span>}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </form>
  );
}
