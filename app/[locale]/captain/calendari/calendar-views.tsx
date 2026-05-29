'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalendarMatchView = {
  id: string;
  scheduledAtISO: string;
  /** Day key in Europe/Madrid timezone, format YYYY-MM-DD. */
  dayKey: string;
  card: React.ReactNode;
};

type Props = {
  locale: 'ca' | 'es';
  matches: CalendarMatchView[];
  labels: {
    list: string;
    week: string;
    previous_week: string;
    next_week: string;
    today: string;
    empty: string;
  };
};

const STORAGE_KEY = 'captain_calendar_view';

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // 0 (Sun) -> -6, 1 (Mon) -> 0, ..., 6 (Sat) -> -5
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toIsoDayKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Madrid',
  });
  return fmt.format(date);
}

export function CaptainCalendarViews({ locale, matches, labels }: Props) {
  const [view, setView] = useState<'list' | 'week'>('list');
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'list' || stored === 'week') setView(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, view);
  }, [view, ready]);

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Madrid',
      }),
    [locale],
  );

  const shortWeekday = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
        weekday: 'short',
        day: '2-digit',
        timeZone: 'Europe/Madrid',
      }),
    [locale],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarMatchView[]>();
    for (const m of matches) {
      const list = map.get(m.dayKey) ?? [];
      list.push(m);
      map.set(m.dayKey, list);
    }
    return map;
  }, [matches]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: labels.list, icon: <LayoutList className="size-3.5" /> },
            { value: 'week', label: labels.week, icon: <CalendarDays className="size-3.5" /> },
          ]}
        />
        {view === 'week' && (
          <div className="ml-auto flex items-center gap-2 text-xs text-white/65">
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label={labels.previous_week}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              {labels.today}
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label={labels.next_week}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {view === 'list' ? (
        <ListView byDay={byDay} dayFormatter={dayFormatter} emptyLabel={labels.empty} />
      ) : (
        <WeekView
          weekStart={weekStart}
          byDay={byDay}
          shortWeekday={shortWeekday}
          emptyLabel={labels.empty}
        />
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-crimson-600 text-white'
              : 'text-white/65 hover:text-white',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ListView({
  byDay,
  dayFormatter,
  emptyLabel,
}: {
  byDay: Map<string, CalendarMatchView[]>;
  dayFormatter: Intl.DateTimeFormat;
  emptyLabel: string;
}) {
  const days = Array.from(byDay.keys()).sort();
  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="space-y-8">
      {days.map((day) => {
        const ms = byDay.get(day) ?? [];
        const firstISO = ms[0]?.scheduledAtISO;
        return (
          <section key={day}>
            <h2 className="mb-3 text-xs font-medium tracking-wider text-white/55 uppercase">
              {firstISO ? dayFormatter.format(new Date(firstISO)) : day}
            </h2>
            <ul className="space-y-3">
              {ms.map((m) => (
                <li key={m.id}>{m.card}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WeekView({
  weekStart,
  byDay,
  shortWeekday,
  emptyLabel,
}: {
  weekStart: Date;
  byDay: Map<string, CalendarMatchView[]>;
  shortWeekday: Intl.DateTimeFormat;
  emptyLabel: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {days.map((day) => {
        const key = toIsoDayKey(day);
        const ms = byDay.get(key) ?? [];
        return (
          <div
            key={key}
            className="flex min-h-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-white/65 uppercase">
              {shortWeekday.format(day)}
            </h3>
            {ms.length === 0 ? (
              <p className="text-[11px] text-white/35">{emptyLabel}</p>
            ) : (
              <ul className="space-y-2">
                {ms.map((m) => (
                  <li key={m.id}>{m.card}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
