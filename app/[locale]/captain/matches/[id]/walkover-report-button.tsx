'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { submitWalkoverReport } from './actions';

/**
 * Alternativa al ReportForm quan el partit no s'ha pogut completar (lesió,
 * retirada a mig partit o incompareixença). En comptes d'obligar a introduir
 * un marcador (que submitReport rebutjaria si algun set no és vàlid), el
 * capità només indica QUI s'ha retirat. Segueix el mateix circuit de doble
 * confirmació que un report normal (pending_validation/disputed).
 */
export function WalkoverReportButton({ matchId }: { matchId: string }) {
  const t = useTranslations('captain');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(claim: 'we_retired' | 'rival_retired') {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('matchId', matchId);
      fd.set('claim', claim);
      const res = await submitWalkoverReport(fd);
      if (!res.ok) {
        setError(t(`error_${res.error}` as 'error_invalid_input'));
        return;
      }
      setSuccess(true);
      setOpen(false);
    });
  }

  if (success) {
    return <p className="text-sm text-green-600">{t('walkover_submitted_ok')}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
      >
        {t('walkover_toggle_cta')}
      </button>
    );
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-md border p-4 text-sm">
      <div>
        <p className="font-medium">{t('walkover_title')}</p>
        <p className="text-muted-foreground text-xs">{t('walkover_subtitle')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => submit('rival_retired')}
          className="justify-start text-left"
        >
          {t('walkover_rival_retired')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => submit('we_retired')}
          className="justify-start text-left"
        >
          {t('walkover_we_retired')}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {t('walkover_cancel')}
        </Button>
      </div>
    </div>
  );
}
