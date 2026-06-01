import { Trophy, Sparkles, LockOpen, Lock } from 'lucide-react';
import {
  computeBracketPreview,
  formatSlotPlaceholder,
  type GroupInfo,
  type PreviewMatch,
  type PreviewSlot,
  type StandingRow,
} from '@/lib/bracket-preview';

type Props = {
  standings: StandingRow[];
  groups: GroupInfo[];
  pairLabels: Map<string, string>;
  locale: 'ca' | 'es';
  labels: {
    title: string;
    subtitle: string;
    main: string;
    consolation: string;
    finished_badge: string;
    preliminary_badge: string;
    not_feasible: string;
  };
};

export function BracketPreviewCard({ standings, groups, pairLabels, locale, labels }: Props) {
  const preview = computeBracketPreview(standings, groups);

  if (!preview.feasible || (preview.main.length === 0 && preview.consolation.length === 0)) {
    return (
      <div className="border-border bg-muted/30 rounded-md border p-4 text-xs">
        <p className="text-muted-foreground">{labels.not_feasible}</p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-md border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4" />
            {labels.title}
          </p>
          <p className="text-muted-foreground text-xs">{labels.subtitle}</p>
        </div>
        <Badge finished={preview.groupPhaseFinished} labels={labels} />
      </header>

      {preview.main.length > 0 && (
        <Section
          title={labels.main}
          icon={<Trophy className="size-3.5" />}
          matches={preview.main}
          pairLabels={pairLabels}
          locale={locale}
        />
      )}
      {preview.consolation.length > 0 && (
        <Section
          title={labels.consolation}
          icon={<Sparkles className="size-3.5" />}
          matches={preview.consolation}
          pairLabels={pairLabels}
          locale={locale}
        />
      )}
    </div>
  );
}

function Badge({ finished, labels }: { finished: boolean; labels: Props['labels'] }) {
  if (finished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-600 uppercase dark:text-emerald-300">
        <Lock className="size-3" />
        {labels.finished_badge}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">
      <LockOpen className="size-3" />
      {labels.preliminary_badge}
    </span>
  );
}

function Section({
  title,
  icon,
  matches,
  pairLabels,
  locale,
}: {
  title: string;
  icon: React.ReactNode;
  matches: PreviewMatch[];
  pairLabels: Map<string, string>;
  locale: 'ca' | 'es';
}) {
  return (
    <section>
      <h3 className="text-muted-foreground mb-2 flex items-center gap-1 text-[11px] font-semibold tracking-widest uppercase">
        {icon}
        {title}
      </h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {matches.map((m) => (
          <li
            key={`${m.phase}-${m.round_size}-${m.position}`}
            className="border-border bg-muted/40 rounded-md border p-3 text-xs"
          >
            <p className="text-muted-foreground mb-1 font-mono text-[10px]">
              {labelForMatch(m, locale)}
            </p>
            <p className="font-medium">
              <SlotDisplay slot={m.a} pairLabels={pairLabels} locale={locale} />
            </p>
            <p className="text-muted-foreground my-0.5 font-mono text-[10px]">vs</p>
            <p className="font-medium">
              <SlotDisplay slot={m.b} pairLabels={pairLabels} locale={locale} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SlotDisplay({
  slot,
  pairLabels,
  locale,
}: {
  slot: PreviewSlot;
  pairLabels: Map<string, string>;
  locale: 'ca' | 'es';
}) {
  const placeholder = formatSlotPlaceholder(slot, locale);
  if (slot.kind === 'pair') {
    const name = pairLabels.get(slot.pair_id) ?? '—';
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        <span>{name}</span>
        <span
          className={`text-[10px] font-normal ${slot.locked ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}`}
        >
          ({placeholder}
          {slot.locked ? '' : '*'})
        </span>
      </span>
    );
  }
  return <span className="text-muted-foreground italic">{placeholder}</span>;
}

function labelForMatch(m: PreviewMatch, locale: 'ca' | 'es'): string {
  // p.ex. SF1, QF2, Final, Cons. SF1…
  const tag = phaseTag(m.round_size, locale);
  const prefix = m.phase === 'cons' ? (locale === 'ca' ? 'Cons. ' : 'Cons. ') : '';
  if (m.round_size === 2) return `${prefix}${tag}`;
  return `${prefix}${tag}${m.position}`;
}

function phaseTag(roundSize: number, locale: 'ca' | 'es'): string {
  if (roundSize === 2) return locale === 'ca' ? 'Final' : 'Final';
  if (roundSize === 4) return 'SF';
  if (roundSize === 8) return 'QF';
  if (roundSize === 16) return 'R16';
  return `R${roundSize}`;
}
