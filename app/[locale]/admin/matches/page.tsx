import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { formatMatchDateTime } from '@/lib/format-date';
import { ScheduleForm } from './schedule-form';
import { AutoScheduleControls } from './auto-schedule-button';
import { SchedulerProvider } from './scheduler-context';
import { WalkoverButton } from '../walkover-button';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; status?: string }>;
};

const VALID_MATCH_STATUSES = [
  'scheduled',
  'pending_validation',
  'validated',
  'disputed',
  'walkover',
] as const;
type MatchStatus = (typeof VALID_MATCH_STATUSES)[number];

function asMatchStatus(value: string | undefined): MatchStatus | null {
  return value && (VALID_MATCH_STATUSES as readonly string[]).includes(value)
    ? (value as MatchStatus)
    : null;
}

export default async function MatchesAdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es')
    .eq('tournament_id', tournament?.id ?? '')
    .order('level');

  let query = supabase
    .from('matches')
    .select(
      'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status',
    )
    .eq('tournament_id', tournament?.id ?? '')
    .order('scheduled_at', { ascending: true, nullsFirst: true })
    .limit(200);

  if (sp.category) query = query.eq('category_id', sp.category);
  const matchStatus = asMatchStatus(sp.status);
  if (matchStatus) query = query.eq('status', matchStatus);

  const { data: matches } = await query;

  const pairIds = (matches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id]);
  const { data: pairs } = pairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
    : { data: [] };

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', playerIds)
    : { data: [] };

  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return pairId.slice(0, 8);
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${fullName(a)} / ${fullName(b)}`;
  };

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  return (
    <SchedulerProvider>
      <section className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t('matches_title')}</h1>
          <AutoScheduleControls />
        </header>

        <div className="flex flex-wrap gap-2 text-xs">
          <CategoryFilter categories={categories ?? []} current={sp.category} locale={locale} />
        </div>

        {!matches || matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('matches_empty')}</p>
        ) : (
          <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
            {matches.map((m) => (
              <li key={m.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {pairLabel(m.pair_a_id)} <span className="text-muted-foreground">vs</span>{' '}
                      {pairLabel(m.pair_b_id)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {categoriesById.get(m.category_id) ?? ''} · {m.phase}{' '}
                      {m.group_label ? `(${m.group_label})` : ''} ·{' '}
                      {t(`match_status_${m.status}` as 'match_status_scheduled')}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {m.scheduled_at
                      ? formatMatchDateTime(m.scheduled_at, locale)
                      : t('match_not_scheduled')}{' '}
                    · {m.court_label ?? t('match_no_court')}
                  </p>
                </div>
                <ScheduleForm
                  matchId={m.id}
                  scheduledAt={m.scheduled_at}
                  courtLabel={m.court_label}
                />
                {/* Walkover disponible per a qualsevol partit no resolt encara
                    (incompareixença, però també retirada/lesió a mig partit,
                    que deixa el partit en 'scheduled' sense cap report). Els
                    ja 'validated'/'walkover' no es toquen des d'aquí. */}
                {m.status !== 'validated' && m.status !== 'walkover' && (
                  <WalkoverButton
                    matchId={m.id}
                    pairAId={m.pair_a_id}
                    pairBId={m.pair_b_id}
                    pairALabel={pairLabel(m.pair_a_id)}
                    pairBLabel={pairLabel(m.pair_b_id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SchedulerProvider>
  );
}

function CategoryFilter({
  categories,
  current,
  locale,
}: {
  categories: { id: string; level: number; name_ca: string; name_es: string }[];
  current?: string;
  locale: Locale;
}) {
  return (
    <>
      <a
        href={`/${locale}/admin/matches`}
        className={
          !current
            ? 'rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-[hsl(var(--primary-foreground))]'
            : 'rounded-md border border-[hsl(var(--border))] px-3 py-1'
        }
      >
        Totes
      </a>
      {categories.map((c) => (
        <a
          key={c.id}
          href={`/${locale}/admin/matches?category=${c.id}`}
          className={
            current === c.id
              ? 'rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-[hsl(var(--primary-foreground))]'
              : 'rounded-md border border-[hsl(var(--border))] px-3 py-1'
          }
        >
          {locale === 'ca' ? c.name_ca : c.name_es}
        </a>
      ))}
    </>
  );
}
