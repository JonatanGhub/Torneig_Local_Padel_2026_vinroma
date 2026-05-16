'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setWalkover } from './actions';

/**
 * Botón + diálogo inline para marcar un partido como walkover.
 * El admin elige qué pareja gana y opcionalmente añade una razón.
 */
export function WalkoverButton({
  matchId,
  pairAId,
  pairBId,
  pairALabel,
  pairBLabel,
}: {
  matchId: string;
  pairAId: string;
  pairBId: string;
  pairALabel: string;
  pairBLabel: string;
}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await setWalkover(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpen(false);
        setWinner('');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]"
      >
        <Trophy className="size-3" />
        {t('walkover_cta')}
      </button>
    );
  }

  return (
    <form action={submit} className="bg-card mt-2 space-y-2 rounded-md border p-3 text-xs">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="font-medium">{t('walkover_title')}</p>
      <p className="text-muted-foreground">{t('walkover_subtitle')}</p>

      <div className="space-y-1">
        <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
          {t('walkover_winner')}
        </label>
        <select
          name="winnerPairId"
          required
          value={winner}
          onChange={(e) => setWinner(e.target.value)}
          className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2"
        >
          <option value="">—</option>
          <option value={pairAId}>{pairALabel}</option>
          <option value={pairBId}>{pairBLabel}</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
          {t('walkover_reason')}
        </label>
        <Input
          type="text"
          name="reason"
          maxLength={500}
          placeholder={t('walkover_reason_placeholder')}
          className="h-8 text-xs"
        />
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={isPending}
        >
          {t('walkover_cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !winner}>
          {isPending ? '…' : t('walkover_confirm')}
        </Button>
      </div>
    </form>
  );
}
