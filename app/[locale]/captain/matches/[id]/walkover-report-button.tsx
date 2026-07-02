'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { submitWalkoverReport } from './actions';

type RealSet = { set: number; a: number; b: number };

/**
 * Alternativa al ReportForm quan el partit no s'ha pogut completar (lesió,
 * retirada a mig partit o incompareixença). En comptes d'obligar a introduir
 * un marcador (que submitReport rebutjaria si algun set no és vàlid), el
 * capità només indica QUI s'ha retirat. Segueix el mateix circuit de doble
 * confirmació que un report normal (pending_validation/disputed).
 *
 * El marcador parcial (p.ex. "anàvem 1-1, 2-0 quan s'ha retirat") és
 * opcional i purament informatiu: no determina qui guanya (ho decideix
 * exclusivament l'opció triada) ni afecta si els dos capitans hi estan
 * d'acord, perquè cadascú podria recordar-lo de manera lleugerament
 * diferent i no volem que això generi una disputa nova.
 */
export function WalkoverReportButton({ matchId }: { matchId: string }) {
  const t = useTranslations('captain');
  const [open, setOpen] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [sets, setSets] = useState<RealSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function addSet() {
    setSets((prev) => (prev.length < 3 ? [...prev, { set: prev.length + 1, a: 0, b: 0 }] : prev));
  }

  function removeSet(idx: number) {
    setSets((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, set: i + 1 })));
  }

  function updateSet(idx: number, side: 'a' | 'b', value: number) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [side]: value } : s)));
  }

  function submit(claim: 'we_retired' | 'rival_retired') {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('matchId', matchId);
      fd.set('claim', claim);
      if (sets.length > 0) fd.set('realScore', JSON.stringify(sets));
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
    // Botó destacat (no un enllaç petit): un capità que ve d'un partit
    // interromput per lesió ha de trobar aquesta sortida a simple vista,
    // sobretot després que el formulari normal li rebutgi el marcador.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
      >
        🚑 {t('walkover_toggle_cta')}
      </button>
    );
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-md border p-4 text-sm">
      <div>
        <p className="font-medium">{t('walkover_title')}</p>
        <p className="text-muted-foreground text-xs">{t('walkover_subtitle')}</p>
      </div>

      <div className="space-y-2">
        {showScore ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {t('walkover_real_score_label')}
            </p>
            {sets.map((s, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <NumberInput label={t('us')} value={s.a} onChange={(v) => updateSet(idx, 'a', v)} />
                <span className="text-muted-foreground pb-2 text-xl font-light">–</span>
                <NumberInput
                  label={t('them')}
                  value={s.b}
                  onChange={(v) => updateSet(idx, 'b', v)}
                />
                <button
                  type="button"
                  onClick={() => removeSet(idx)}
                  className="text-muted-foreground hover:text-destructive pb-2 text-xs"
                >
                  {t('remove_third_set')}
                </button>
              </div>
            ))}
            {sets.length < 3 && (
              <button
                type="button"
                onClick={addSet}
                className="border-crimson-500/40 text-crimson-700 dark:text-crimson-400 w-full rounded-md border border-dashed py-2 text-xs"
              >
                + {t('walkover_add_set')}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowScore(true);
              addSet();
            }}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            {t('walkover_add_real_score_cta')}
          </button>
        )}
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

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1 text-center">
      <span className="text-muted-foreground block text-[10px]">{label}</span>
      <input
        type="number"
        min={0}
        max={7}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
        className="h-10 w-14 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-center font-mono text-lg font-semibold text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:outline-none"
      />
    </label>
  );
}
