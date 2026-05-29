import { Check, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MatchCardStatus =
  | 'scheduled'
  | 'pending_validation'
  | 'validated'
  | 'disputed'
  | 'walkover';

export type MatchCardPhase = 'group' | 'r16' | 'qf' | 'sf' | 'final' | null;

export type MatchCardProps = {
  category: string;
  groupLabel?: string | null;
  phase?: MatchCardPhase;
  pairALabel: string;
  pairBLabel: string;
  scheduledAt: string | null;
  courtLabel: string | null;
  status: MatchCardStatus;
  winnerLabel?: 'a' | 'b' | null;
  myPairSide?: 'a' | 'b' | null;
  scoreText?: string | null;
  locale: 'ca' | 'es';
  actions?: React.ReactNode;
};

const STATUS_LABELS: Record<MatchCardStatus, Record<'ca' | 'es', string>> = {
  scheduled: { ca: 'Programat', es: 'Programado' },
  pending_validation: { ca: 'Per validar', es: 'Por validar' },
  disputed: { ca: 'En disputa', es: 'En disputa' },
  validated: { ca: 'Validat', es: 'Validado' },
  walkover: { ca: 'W.O.', es: 'W.O.' },
};

const PHASE_LABELS: Record<NonNullable<MatchCardPhase>, Record<'ca' | 'es', string>> = {
  group: { ca: 'Grup', es: 'Grupo' },
  r16: { ca: '1/8', es: '1/8' },
  qf: { ca: 'Quarts', es: 'Cuartos' },
  sf: { ca: 'Semis', es: 'Semis' },
  final: { ca: 'Final', es: 'Final' },
};

const TU_LABELS: Record<'ca' | 'es', string> = { ca: 'Tu', es: 'Tú' };
const NO_DATE_LABELS: Record<'ca' | 'es', string> = { ca: 'Sense data', es: 'Sin fecha' };
const NO_COURT_LABELS: Record<'ca' | 'es', string> = { ca: 'Sense pista', es: 'Sin pista' };

function statusPillClasses(status: MatchCardStatus): string {
  switch (status) {
    case 'pending_validation':
      return 'border-blue-400/40 bg-blue-400/10 text-blue-300';
    case 'disputed':
      return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
    case 'validated':
      return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
    case 'walkover':
      return 'border-white/15 bg-white/5 text-white/65';
    default:
      return 'border-white/15 bg-white/5 text-white/65';
  }
}

function formatScheduled(iso: string, locale: 'ca' | 'es'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
  return formatter.format(new Date(iso));
}

export function MatchCard({
  category,
  groupLabel,
  phase,
  pairALabel,
  pairBLabel,
  scheduledAt,
  courtLabel,
  status,
  winnerLabel,
  myPairSide,
  scoreText,
  locale,
  actions,
}: MatchCardProps) {
  const statusLabel = STATUS_LABELS[status][locale];
  const phaseLabel = phase ? PHASE_LABELS[phase][locale] : null;
  const tuLabel = TU_LABELS[locale];
  const noDate = NO_DATE_LABELS[locale];
  const noCourt = NO_COURT_LABELS[locale];

  return (
    <article
      className={cn(
        'group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-colors md:p-5',
        'dark:bg-ink-900/40',
        'hover:border-crimson-400/40',
      )}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="bg-crimson-500/15 text-crimson-300 rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
          {category}
        </span>
        {groupLabel ? (
          <span className="text-[11px] text-white/55">
            {locale === 'ca' ? 'Grup' : 'Grupo'} {groupLabel}
          </span>
        ) : null}
        {phaseLabel ? <span className="text-[11px] text-white/55">{phaseLabel}</span> : null}
        <span
          className={cn(
            'ml-auto inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase',
            statusPillClasses(status),
          )}
        >
          {statusLabel}
        </span>
      </header>

      <div className="space-y-2">
        <PairLine
          label={pairALabel}
          isWinner={winnerLabel === 'a'}
          isMine={myPairSide === 'a'}
          tuLabel={tuLabel}
        />
        <PairLine
          label={pairBLabel}
          isWinner={winnerLabel === 'b'}
          isMine={myPairSide === 'b'}
          tuLabel={tuLabel}
        />
      </div>

      {scoreText ? (
        <p className="mt-3 font-mono text-sm tracking-wide text-white/80">{scoreText}</p>
      ) : null}

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {scheduledAt ? formatScheduled(scheduledAt, locale) : noDate}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {courtLabel ?? noCourt}
        </span>
      </footer>

      {actions ? <div className="mt-4">{actions}</div> : null}
    </article>
  );
}

function PairLine({
  label,
  isWinner,
  isMine,
  tuLabel,
}: {
  label: string;
  isWinner: boolean;
  isMine: boolean;
  tuLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {isWinner ? <Check className="size-4 shrink-0 text-emerald-300" /> : null}
      <span
        className={cn(
          'min-w-0 truncate text-base font-semibold md:text-lg',
          isMine ? 'text-crimson-300' : 'text-white',
        )}
      >
        {label}
      </span>
      {isMine ? (
        <span className="bg-crimson-500/20 text-crimson-200 ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          {tuLabel}
        </span>
      ) : null}
    </div>
  );
}
