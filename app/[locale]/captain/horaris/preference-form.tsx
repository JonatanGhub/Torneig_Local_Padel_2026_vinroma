'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { saveSchedulePreference } from './actions';

export type DayState = 'no' | 'ok' | 'prefer';

type Props = {
  pairId: string;
  pairTitle: string;
  days: { iso: string; label: string }[];
  initialPrefs: Record<string, DayState>;
  initialNote: string | null;
};

// Cicle en tocar un xip de dia: (res) → no puc → em va bé → preferit → (res).
const CYCLE: (DayState | undefined)[] = [undefined, 'no', 'ok', 'prefer'];

const STATE_STYLE: Record<DayState, string> = {
  no: 'border-red-500/60 bg-red-500/15 text-red-300',
  ok: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
  prefer: 'border-amber-400/70 bg-amber-400/15 text-amber-300',
};

const STATE_EMOJI: Record<DayState, string> = { no: '❌', ok: '👍', prefer: '⭐' };

export function PreferenceForm({ pairId, pairTitle, days, initialPrefs, initialNote }: Props) {
  const t = useTranslations('captain');
  const [prefs, setPrefs] = useState<Record<string, DayState>>(initialPrefs);
  const [note, setNote] = useState(initialNote ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cycleDay(iso: string) {
    setFeedback(null);
    setPrefs((prev) => {
      const current = prev[iso];
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      const copy = { ...prev };
      if (next === undefined) delete copy[iso];
      else copy[iso] = next;
      return copy;
    });
  }

  function handleSave() {
    setError(null);
    setFeedback(null);
    const fd = new FormData();
    fd.set('pairId', pairId);
    fd.set('dayPrefs', JSON.stringify(prefs));
    fd.set('note', note);
    startTransition(async () => {
      const res = await saveSchedulePreference(fd);
      if (res.ok) setFeedback(t('prefs_saved_ok'));
      else setError(t('prefs_error'));
    });
  }

  return (
    <div className="glass-card space-y-4 rounded-2xl p-5">
      <p className="font-display text-lg font-semibold text-white">{pairTitle}</p>

      <div className="space-y-2">
        {days.map((d) => {
          const state = prefs[d.iso];
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => cycleDay(d.iso)}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors',
                state
                  ? STATE_STYLE[state]
                  : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10',
              )}
            >
              <span className="font-medium capitalize">{d.label}</span>
              <span>
                {state
                  ? `${STATE_EMOJI[state]} ${t(`prefs_state_${state}`)}`
                  : t('prefs_state_unset')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-white/55">{t('prefs_note_label')}</label>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setFeedback(null);
          }}
          maxLength={500}
          rows={2}
          placeholder={t('prefs_note_placeholder')}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:outline-none"
        />
      </div>

      {feedback && <p className="text-xs text-emerald-300">{feedback}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}

      <Button onClick={handleSave} disabled={isPending} type="button" className="w-full">
        {isPending ? '…' : t('prefs_save')}
      </Button>
    </div>
  );
}
