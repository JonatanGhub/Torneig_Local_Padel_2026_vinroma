'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { saveSchedulePreference } from './actions';

export type SlotState = 'ok' | 'no';

type Props = {
  pairId: string;
  pairTitle: string;
  days: { iso: string; label: string }[];
  times: readonly string[];
  // Clau: "2026-08-03T19:00" → 'ok' | 'no'. Les franges no marcades són
  // "indiferent".
  initialPrefs: Record<string, SlotState>;
  initialNote: string | null;
};

// Cicle en tocar una franja: (res) → ✅ puc → ❌ no puc → (res).
const CYCLE: (SlotState | undefined)[] = [undefined, 'ok', 'no'];

const STATE_STYLE: Record<SlotState, string> = {
  ok: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
  no: 'border-red-500/60 bg-red-500/15 text-red-300',
};

const STATE_EMOJI: Record<SlotState, string> = { ok: '✅', no: '❌' };

export function PreferenceForm({
  pairId,
  pairTitle,
  days,
  times,
  initialPrefs,
  initialNote,
}: Props) {
  const t = useTranslations('captain');
  const [prefs, setPrefs] = useState<Record<string, SlotState>>(initialPrefs);
  const [note, setNote] = useState(initialNote ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cycleSlot(key: string) {
    setFeedback(null);
    setPrefs((prev) => {
      const current = prev[key];
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      const copy = { ...prev };
      if (next === undefined) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  function handleSave() {
    setError(null);
    setFeedback(null);
    const fd = new FormData();
    fd.set('pairId', pairId);
    fd.set('slotPrefs', JSON.stringify(prefs));
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

      <div className="space-y-3">
        {days.map((d) => (
          <div key={d.iso} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-sm font-medium text-white capitalize">{d.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {times.map((time) => {
                const key = `${d.iso}T${time}`;
                const state = prefs[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => cycleSlot(key)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-sm transition-colors',
                      state
                        ? STATE_STYLE[state]
                        : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
                    )}
                  >
                    <span className="font-mono font-medium">{time}</span>
                    <span className="text-xs">
                      {state
                        ? `${STATE_EMOJI[state]} ${t(`prefs_state_${state}`)}`
                        : t('prefs_state_unset')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
