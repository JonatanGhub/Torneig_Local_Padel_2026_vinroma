import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { LogoLockup } from '@/components/brand/logo-mark';

type Props = { params: Promise<{ locale: Locale }> };

export default async function CaptainHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain`);

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!player) {
    return <NoProfilePage locale={locale} t={t} />;
  }

  const { data: myPairs } = await supabase
    .from('pairs')
    .select('id, status, category_id, group_id, player_a_id, player_b_id, captain_id')
    .eq('captain_id', player.id);

  const myPairIds = (myPairs ?? []).map((p) => p.id);

  const { data: matches } = myPairIds.length
    ? await supabase
        .from('matches')
        .select(
          'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id',
        )
        .or(myPairIds.map((id) => `pair_a_id.eq.${id},pair_b_id.eq.${id}`).join(','))
        .order('scheduled_at', { ascending: true, nullsFirst: true })
    : { data: [] };

  const categoriesData = await supabase.from('categories').select('id, name_ca, name_es');
  const categoryLabel = new Map(
    (categoriesData.data ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  const rivalPairIds = (matches ?? []).flatMap((m) =>
    myPairIds.includes(m.pair_a_id) ? [m.pair_b_id] : [m.pair_a_id],
  );
  const { data: rivals } = rivalPairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', rivalPairIds)
    : { data: [] };

  const allPlayerIds = (rivals ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = allPlayerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', allPlayerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = rivals?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  const total = matches?.length ?? 0;
  const validated = (matches ?? []).filter(
    (m) => m.status === 'validated' || m.status === 'walkover',
  );
  const wins = validated.filter((m) =>
    myPairIds.includes(m.pair_a_id)
      ? m.winner_pair_id === m.pair_a_id
      : m.winner_pair_id === m.pair_b_id,
  ).length;
  const upcoming = (matches ?? []).filter(
    (m) => m.status === 'scheduled' || m.status === 'pending_validation' || m.status === 'disputed',
  );
  const past = validated;

  return (
    <div className="bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t('common.back')}
          </Link>
        </div>
      </div>

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

        <Link
          href={`/${locale}/captain/finance`}
          className="glass-card hover:border-crimson-400/40 group mb-6 flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-crimson-500/15 text-crimson-300 inline-flex size-10 items-center justify-center rounded-xl">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-white">
                {t('captain.finance_card_title')}
              </p>
              <p className="text-xs text-white/55">{t('captain.finance_card_body')}</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-white/45 transition-transform group-hover:translate-x-1" />
        </Link>

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
                const rivalPairId = myPairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id;
                return (
                  <MatchCard
                    key={m.id}
                    href={`/${locale}/captain/matches/${m.id}`}
                    locale={locale}
                    rival={pairLabel(rivalPairId)}
                    category={categoryLabel.get(m.category_id) ?? ''}
                    groupLabel={m.group_label}
                    scheduledAt={m.scheduled_at}
                    courtLabel={m.court_label}
                    status={m.status}
                    cta={
                      m.status === 'pending_validation'
                        ? t('captain.review_result')
                        : m.status === 'disputed'
                          ? t('captain.disputed')
                          : t('captain.report_result')
                    }
                    statusLabel={
                      m.status === 'pending_validation'
                        ? t('captain.match_pill_pending')
                        : m.status === 'disputed'
                          ? t('captain.match_pill_disputed')
                          : t('captain.match_pill_scheduled')
                    }
                  />
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
                const rivalPairId = myPairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id;
                const myPairId = myPairIds.includes(m.pair_a_id) ? m.pair_a_id : m.pair_b_id;
                const youWon = m.winner_pair_id === myPairId;
                return (
                  <li
                    key={m.id}
                    className="glass-card flex items-center justify-between gap-3 rounded-2xl p-4 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">
                        <span className="text-white/55">{t('captain.vs')}</span>{' '}
                        {pairLabel(rivalPairId)}
                      </p>
                      <p className="text-xs text-white/55">
                        {categoryLabel.get(m.category_id) ?? ''}
                        {m.group_label ? ` · Grup ${m.group_label}` : ''}
                      </p>
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
    </div>
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

function MatchCard({
  href,
  locale,
  rival,
  category,
  groupLabel,
  scheduledAt,
  courtLabel,
  status,
  cta,
  statusLabel,
}: {
  href: string;
  locale: string;
  rival: string;
  category: string;
  groupLabel: string | null;
  scheduledAt: string | null;
  courtLabel: string | null;
  status: string;
  cta: string;
  statusLabel: string;
}) {
  const pillTone =
    status === 'disputed'
      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
      : status === 'pending_validation'
        ? 'border-blue-400/40 bg-blue-400/10 text-blue-300'
        : 'border-white/15 bg-white/5 text-white/65';

  return (
    <li className="glass-card hover:border-crimson-400/40 group rounded-2xl p-5 transition-colors">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="text-crimson-300 size-4" />
            <p className="font-display text-lg font-semibold text-white">{rival}</p>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase ${pillTone}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
            <span className="bg-crimson-500/15 text-crimson-300 rounded px-1.5 py-0.5">
              {category}
            </span>
            {groupLabel && <span>Grup {groupLabel}</span>}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {scheduledAt
                ? new Date(scheduledAt).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '—'}
            </span>
            <span>· {courtLabel ?? '—'}</span>
          </p>
        </div>
        <Link
          href={href}
          className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors sm:self-center"
        >
          {cta}
        </Link>
      </div>
    </li>
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

function NoProfilePage({
  locale,
  t,
}: {
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6">
        <div className="glass-card w-full rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">{t('captain.no_profile_title')}</h1>
          <p className="mt-2 text-sm text-white/65">{t('captain.no_profile_body')}</p>
          <Link
            href={`/${locale}`}
            className="bg-crimson-600 hover:bg-crimson-500 mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </Link>
        </div>
      </main>
    </div>
  );
}
