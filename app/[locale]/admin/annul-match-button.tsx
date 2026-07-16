'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { annulMatchResult } from './actions';

/**
 * Botón + formulario inline para anular el resultado de un partido ya
 * jugado (validated/walkover/disputed/pending_validation) y devolverlo a
 * "por jugar". La nueva fecha/pista son opcionales: si se dejan en blanco,
 * el partido queda sin programar y cualquiera de los dos capitanes lo puede
 * reprogramar desde su propio flujo de "proponer cambio de fecha".
 */
export function AnnulMatchButton({ matchId }: { matchId: string }) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [newCourtLabel, setNewCourtLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await annulMatchResult(formData);
      if (!res.ok) {
        setError(t(`annul_error_${res.error}` as 'annul_error_unknown'));
      } else {
        setOpen(false);
        setConfirmStep(false);
        setNewScheduledAt('');
        setNewCourtLabel('');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-destructive inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]"
      >
        <RotateCcw className="size-3" />
        {t('annul_cta')}
      </button>
    );
  }

  return (
    <form action={submit} className="bg-card mt-2 space-y-2 rounded-md border p-3 text-xs">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="font-medium">{t('annul_title')}</p>
      <p className="text-muted-foreground">{t('annul_subtitle')}</p>

      <div className="space-y-1">
        <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
          {t('annul_new_date_label')}
        </label>
        <Input
          type="datetime-local"
          name="newScheduledAt"
          value={newScheduledAt}
          onChange={(e) => setNewScheduledAt(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {newScheduledAt && (
        <div className="space-y-1">
          <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
            {t('annul_new_court_label')}
          </label>
          <Input
            type="text"
            name="newCourtLabel"
            maxLength={40}
            placeholder="Pista 2"
            value={newCourtLabel}
            onChange={(e) => setNewCourtLabel(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
          {t('walkover_reason')}
        </label>
        <Input
          type="text"
          name="reason"
          maxLength={500}
          placeholder={t('annul_reason_placeholder')}
          className="h-8 text-xs"
        />
      </div>

      {error && <p className="text-destructive">{error}</p>}

      {confirmStep && !error && <p className="text-destructive">{t('annul_confirm_warning')}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setConfirmStep(false);
            setError(null);
          }}
          disabled={isPending}
        >
          {t('walkover_cancel')}
        </Button>
        {confirmStep ? (
          <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
            {isPending ? '…' : t('annul_confirm')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setConfirmStep(true)}
          >
            {t('annul_confirm')}
          </Button>
        )}
      </div>
    </form>
  );
}
