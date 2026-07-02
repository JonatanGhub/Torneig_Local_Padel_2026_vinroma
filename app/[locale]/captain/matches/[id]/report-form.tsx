'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/supabase';
import { submitReport } from './actions';

type SetScore = { set: number; a: number; b: number };

// Un walkover desa un marcador placeholder (6-0/6-0) que no reflecteix cap
// joc real; en la vista de només lectura val més dir-ho clarament (i, si el
// capità hi va afegir un marcador parcial informatiu, mostrar-lo) que fer
// veure que es va jugar un 6-0/6-0.
function walkoverInfo(
  json: Json | null,
): { retired: true; realScoreText: string | null } | { retired: false } {
  if (!Array.isArray(json) || json.length === 0) return { retired: false };
  const first = json[0];
  if (typeof first !== 'object' || first === null || (first as { wo?: unknown }).wo !== true) {
    return { retired: false };
  }
  const real = (first as { wo_real_score?: unknown }).wo_real_score;
  const realScoreText = Array.isArray(real)
    ? real
        .filter(
          (s): s is { a: number; b: number } =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as { a: unknown }).a === 'number' &&
            typeof (s as { b: unknown }).b === 'number',
        )
        .map((s) => `${s.a}-${s.b}`)
        .join(', ') || null
    : null;
  return { retired: true, realScoreText };
}

function parseInitialScore(json: Json | null): SetScore[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (s): s is { set: number; a: number; b: number } =>
        typeof s === 'object' &&
        s !== null &&
        'set' in s &&
        'a' in s &&
        'b' in s &&
        typeof (s as { set: unknown }).set === 'number' &&
        typeof (s as { a: unknown }).a === 'number' &&
        typeof (s as { b: unknown }).b === 'number',
    )
    .map((s) => ({ set: s.set, a: s.a, b: s.b }));
}

export function ReportForm({
  matchId,
  defaultScore,
  readOnly = false,
}: {
  matchId: string;
  defaultScore: Json | null;
  readOnly?: boolean;
}) {
  const t = useTranslations('captain');
  const initial = parseInitialScore(defaultScore);
  const [sets, setSets] = useState<SetScore[]>(() =>
    initial.length > 0
      ? initial
      : [
          { set: 1, a: 0, b: 0 },
          { set: 2, a: 0, b: 0 },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Un cop enviat amb èxit, bloquegem el botó perquè un segon toc (impacient,
  // sense veure encara el missatge de confirmació) no torni a enviar el
  // mateix resultat i disparin les notificacions per duplicat. Es desbloqueja
  // si l'usuari torna a tocar algun marcador (vol enviar un canvi real).
  const [justSubmitted, setJustSubmitted] = useState(false);

  function updateSet(idx: number, side: 'a' | 'b', value: number) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [side]: value } : s)));
    setJustSubmitted(false);
  }

  function addThirdSet() {
    setSets((prev) => (prev.length < 3 ? [...prev, { set: 3, a: 0, b: 0 }] : prev));
    setJustSubmitted(false);
  }

  function removeThirdSet() {
    setSets((prev) => (prev.length > 2 ? prev.slice(0, 2) : prev));
    setJustSubmitted(false);
  }

  const setsAWon = sets.filter((s) => s.a > s.b).length;
  const setsBWon = sets.filter((s) => s.b > s.a).length;
  const needsThirdSet = setsAWon === 1 && setsBWon === 1 && sets.length < 3;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set('matchId', matchId);
    fd.set('score', JSON.stringify(sets));
    startTransition(async () => {
      const res = await submitReport(fd);
      if (!res.ok) {
        setError(t(`error_${res.error}` as 'error_invalid_input'));
        return;
      }
      setSuccess(t('submitted_ok'));
      setJustSubmitted(true);
    });
  }

  if (readOnly) {
    const wo = walkoverInfo(defaultScore);
    return (
      <div className="border-border bg-card rounded-md border p-4">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">
          {t('final_result')}
        </p>
        {wo.retired ? (
          <div className="mt-2">
            <p className="font-display text-2xl font-semibold">{t('walkover_result_label')}</p>
            {wo.realScoreText && (
              <p className="text-muted-foreground mt-1 text-sm">
                {t('walkover_real_score_label')}: {wo.realScoreText}
              </p>
            )}
          </div>
        ) : (
          <p className="font-display mt-2 text-2xl font-semibold">
            {sets.map((s, i) => (
              <span
                key={i}
                className={cn(i > 0 && 'ml-3 border-l border-[hsl(var(--border))] pl-3')}
              >
                {s.a}-{s.b}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        {sets.map((s, idx) => (
          <div key={idx} className="border-border rounded-md border p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-muted-foreground text-xs tracking-wider uppercase">
                {t('set_label', { n: idx + 1 })}
              </p>
              {idx === 2 && (
                <button
                  type="button"
                  onClick={removeThirdSet}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  {t('remove_third_set')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 items-end gap-3">
              <NumberInput label={t('us')} value={s.a} onChange={(v) => updateSet(idx, 'a', v)} />
              <span className="text-muted-foreground pb-2 text-center text-xl font-light">–</span>
              <NumberInput label={t('them')} value={s.b} onChange={(v) => updateSet(idx, 'b', v)} />
            </div>
          </div>
        ))}
      </div>

      {needsThirdSet && (
        <button
          type="button"
          onClick={addThirdSet}
          className="border-crimson-500/40 text-crimson-700 dark:text-crimson-400 w-full rounded-md border border-dashed py-3 text-sm"
        >
          + {t('add_third_set')}
        </button>
      )}

      <div className="border-border bg-secondary text-secondary-foreground rounded-md border p-3 text-sm">
        {setsAWon >= 2 ? (
          <span className="font-medium text-green-600">{t('preview_we_win')}</span>
        ) : setsBWon >= 2 ? (
          <span className="text-muted-foreground">{t('preview_we_lose')}</span>
        ) : (
          <span className="text-muted-foreground">{t('preview_no_winner')}</span>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Button type="submit" disabled={isPending || justSubmitted} className="w-full">
        {isPending ? '…' : t('submit')}
      </Button>
    </form>
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
      <span className="text-muted-foreground block text-xs">{label}</span>
      <input
        type="number"
        min={0}
        max={7}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
        className="h-14 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-center font-mono text-2xl font-semibold text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:outline-none"
      />
    </label>
  );
}
