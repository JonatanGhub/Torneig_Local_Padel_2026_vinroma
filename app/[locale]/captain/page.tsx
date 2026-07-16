import { CalendarClock, Check, Sparkles, Trophy, X } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { MatchCard, type MatchCardPhase } from '@/components/match/match-card';
import { MyPairsCard, type CaptainPairItem } from './my-pairs-card';
import { loadCaptainContext } from '@/lib/captain/data';
import { NoProfilePanel } from './no-profile-panel';
import { CaptainMatchActions } from './match-actions';

type Props = { params: Promise<{ locale: Locale }> };

const PHASE_MAP: Record<string, MatchCardPhase> = {
  group: 'group',
  ko_16: 'r16',
  ko_8: 'qf',
  ko_4: 'sf',
  ko_2: 'final',
  cons_8: 'qf',
  cons_4: 'sf',
  cons_2: 'final',
};

export default async function CaptainHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ctx = await loadCaptainContext(locale);
  if (!ctx.player) return <NoProfilePanel locale={locale} />;

  const {
    player,
    myPairs,
    myPairIds,
    matches,
    pairLabels,
    categoryLabels,
    partnerLabels,
    scoreTextByMatchId,
  } = ctx;
  const pairsWithMatches = new Set(matches.flatMap((m) => [m.pair_a_id, m.pair_b_id]));

  const myPairItems: CaptainPairItem[] = myPairs.map((p) => ({
    id: p.id,
    status: p.status,
    categoryLabel: p.category_id ? (categoryLabels.get(p.category_id) ?? '') : '',
    partnerLabel: partnerLabels.get(p.id) ?? '—',
    withdrawnReason: p.withdrawal_reason,
    hasMatches: pairsWithMatches.has(p.id),
    hasGroup: !!p.group_id,
  }));

  const validated = matches.filter((m) => m.status === 'validated' || m.status === 'walkover');
  const wins = validated.filter((m) =>
    myPairIds.includes(m.pair_a_id)
      ? m.winner_pair_id === m.pair_a_id
      : m.winner_pair_id === m.pair_b_id,
  ).length;
  const upcoming = matches.filter(
    (m) => m.status === 'scheduled' || m.status === 'pending_validation' || m.status === 'disputed',
  );
  const past = validated;
  const total = matches.length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10">
        <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
          {t('captain.role_badge')}
        </p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {t('captain.greeting', { name: player.first_name ?? '' })}
        </h1>
        <p className="mt-2 text-white/65">{t('captain.subtitle')}</p>
      </header>

      <MyPairsCard pairs={myPairItems} locale={locale} />

      <section className="mb-10 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CalendarClock className="size-5" />}
          label={t('captain.stat_total')}
          value={String(total)}
        />
        <StatCard
          icon={<Trophy className="size-5" />}
          label={t('captain.stat_wins')}
          value={`${wins} / ${validated.length}`}
        />
        <StatCard
          icon={<Sparkles className="size-5" />}
          label={t('captain.stat_pending')}
          value={String(upcoming.length)}
        />
      </section>

      <section className="mb-12">
        <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight">
          {t('captain.upcoming_title')}
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-6" />}
            title={t('captain.no_matches')}
            body={t('captain.no_matches_body')}
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((m) => {
              const mySide: 'a' | 'b' = myPairIds.includes(m.pair_a_id) ? 'a' : 'b';
              return (
                <li key={m.id}>
                  <MatchCard
                    category={categoryLabels.get(m.category_id) ?? ''}
                    groupLabel={m.group_label}
                    phase={PHASE_MAP[m.phase] ?? null}
                    pairALabel={pairLabels.get(m.pair_a_id) ?? '—'}
                    pairBLabel={pairLabels.get(m.pair_b_id) ?? '—'}
                    scheduledAt={m.scheduled_at}
                    courtLabel={m.court_label}
                    status={m.status}
                    myPairSide={mySide}
                    locale={locale}
                    actions={
                      <CaptainMatchActions
                        locale={locale}
                        matchId={m.id}
                        status={m.status}
                        scheduledAt={m.scheduled_at}
                        t={t}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight">
            {t('captain.past_title')}
          </h2>
          <ul className="space-y-3">
            {past.map((m) => {
              const myPairId = myPairIds.includes(m.pair_a_id) ? m.pair_a_id : m.pair_b_id;
              const youWon = m.winner_pair_id === myPairId;
              const rivalPairId = myPairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id;
              return (
                <li
                  key={m.id}
                  className="glass-card flex items-center justify-between gap-3 rounded-2xl p-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-white">
                      <span className="text-white/55">{t('captain.vs')}</span>{' '}
                      {pairLabels.get(rivalPairId) ?? '—'}
                    </p>
                    <p className="text-xs text-white/55">
                      {categoryLabels.get(m.category_id) ?? ''}
                      {m.group_label ? ` · Grup ${m.group_label}` : ''}
                    </p>
                    {scoreTextByMatchId.get(m.id) && (
                      <p className="mt-1 font-mono text-xs text-white/80">
                        {scoreTextByMatchId.get(m.id)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                      youWon
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-white/65'
                    }`}
                  >
                    {youWon ? (
                      <>
                        <Check className="size-3" />
                        {t('captain.you_won')}
                      </>
                    ) : (
                      <>
                        <X className="size-3" />
                        {t('captain.you_lost')}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="bg-crimson-500/15 text-crimson-300 mb-3 inline-flex size-9 items-center justify-center rounded-lg">
        {icon}
      </div>
      <p className="text-[10px] tracking-widest text-white/55 uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
      <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
        {icon}
      </div>
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/55">{body}</p>
    </div>
  );
}
