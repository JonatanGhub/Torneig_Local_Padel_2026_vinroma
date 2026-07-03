'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminOverrideScore } from './actions';

type SetScore = { set: number; a: number; b: number };

/**
 * Botón + formulario inline para entrar/corregir el marcador real de un
 * partido. Sustituye admin_set_walkover (marcador fijo) por un marcador
 * set a set introducido por el admin.
 */
export function EditScoreButton({
  matchId,
  initialSets,
}: {
  matchId: string;
  initialSets: SetScore[];
}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<SetScore[]>(() =>
    initialSets.length > 0
      ? initialSets
      : [
          { set: 1, a: 0, b: 0 },
          { set: 2, a: 0, b: 0 },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSet(idx: number, side: 'a' | 'b', value: number) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [side]: value } : s)));
  }

  function addThirdSet() {
    setSets((prev) => (prev.length < 3 ? [...prev, { set: 3, a: 0, b: 0 }] : prev));
  }

  function removeThirdSet() {
    setSets((prev) => (prev.length > 2 ? prev.slice(0, 2) : prev));
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set('score', JSON.stringify(sets));
    startTransition(async () => {
      const res = await adminOverrideScore(formData);
      if (!res.ok) {
        setError(t(`edit_score_error_${res.error}` as 'edit_score_error_unknown'));
      } else {
        setOpen(false);
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
        <Pencil className="size-3" />
        {t('edit_score_cta')}
      </button>
    );
  }

  const setsAWon = sets.filter((s) => s.a > s.b).length;
  const setsBWon = sets.filter((s) => s.b > s.a).length;
  const needsThirdSet = setsAWon === 1 && setsBWon === 1 && sets.length < 3;

  return (
    <form action={submit} className="bg-card mt-2 space-y-3 rounded-md border p-3 text-xs">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="font-medium">{t('edit_score_title')}</p>
      <p className="text-muted-foreground">{t('edit_score_subtitle')}</p>

      <div className="space-y-2">
        {sets.map((s, idx) => (
          <div key={idx} className="border-border flex items-center gap-2 rounded-md border p-2">
            <span className="text-muted-foreground w-10 shrink-0">
              {t('edit_score_set_label', { n: idx + 1 })}
            </span>
            <input
              type="number"
              min={0}
              max={7}
              value={s.a}
              onChange={(e) =>
                updateSet(idx, 'a', Math.max(0, Math.min(7, Number(e.target.value) || 0)))
              }
              className="h-8 w-14 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-center font-mono"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              min={0}
              max={7}
              value={s.b}
              onChange={(e) =>
                updateSet(idx, 'b', Math.max(0, Math.min(7, Number(e.target.value) || 0)))
              }
              className="h-8 w-14 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-center font-mono"
            />
            {idx === 2 && (
              <button
                type="button"
                onClick={removeThirdSet}
                className="text-muted-foreground hover:text-destructive ml-auto"
              >
                {t('edit_score_remove_third_set')}
              </button>
            )}
          </div>
        ))}
      </div>

      {needsThirdSet && (
        <button
          type="button"
          onClick={addThirdSet}
          className="border-crimson-500/40 text-crimson-700 dark:text-crimson-400 w-full rounded-md border border-dashed py-1.5"
        >
          + {t('edit_score_add_third_set')}
        </button>
      )}

      <div className="space-y-1">
        <label className="text-muted-foreground block text-[10px] tracking-wide uppercase">
          {t('walkover_reason')}
        </label>
        <Input
          type="text"
          name="reason"
          maxLength={500}
          placeholder={t('edit_score_reason_placeholder')}
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
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '…' : t('edit_score_confirm')}
        </Button>
      </div>
    </form>
  );
}
