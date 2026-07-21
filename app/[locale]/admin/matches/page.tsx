import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { formatMatchDateTime } from '@/lib/format-date';
import { phaseRoundText } from '@/lib/phase-label';
import { ScheduleForm } from './schedule-form';
import { AutoScheduleControls } from './auto-schedule-button';
import { SchedulerProvider } from './scheduler-context';
import { WalkoverButton } from '../walkover-button';
import { EditScoreButton } from '../edit-score-button';
import { AnnulMatchButton } from '../annul-match-button';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; status?: string; phase?: string }>;
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

  let matchesQuery = supabase
    .from('matches')
    .select(
      'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status',
    )
    .eq('tournament_id', tournament?.id ?? '')
    .order('scheduled_at', { ascending: true, nullsFirst: true })
    .limit(200);

  if (sp.category) matchesQuery = matchesQuery.eq('category_id', sp.category);
  const matchStatus = asMatchStatus(sp.status);
  if (matchStatus) matchesQuery = matchesQuery.eq('status', matchStatus);
  // Filtre de fase: 'group' (fase de grups) o 'ko' (qualsevol eliminatòria,
  // principal o consolació).
  if (sp.phase === 'group') matchesQuery = matchesQuery.eq('phase', 'group');
  if (sp.phase === 'ko') matchesQuery = matchesQuery.neq('phase', 'group');

  // `categories` i `matches` només depenen de tournament.id: es disparen alhora.
  const [{ data: categories }, { data: matches }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament?.id ?? '')
      .order('level'),
    matchesQuery,
  ]);

  const matchIds = (matches ?? []).map((m) => m.id);
  const pairIds = (matches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id]);
  // `sets` i `pairs` només depenen de `matches`: es disparen alhora.
  const [{ data: sets }, { data: pairs }] = await Promise.all([
    matchIds.length
      ? supabase
          .from('sets')
          .select('match_id, set_number, games_a, games_b')
          .in('match_id', matchIds)
          .order('set_number', { ascending: true })
      : Promise.resolve({
          data: [] as { match_id: string; set_number: number; games_a: number; games_b: number }[],
        }),
    pairIds.length
      ? supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
      : Promise.resolve({ data: [] as { id: string; player_a_id: string; player_b_id: string }[] }),
  ]);
  const setsByMatch = new Map<string, { set: number; a: number; b: number }[]>();
  for (const s of sets ?? []) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push({ set: s.set_number, a: s.games_a, b: s.games_b });
    setsByMatch.set(s.match_id, list);
  }
  const scoreText = (matchId: string) => {
    const matchSets = setsByMatch.get(matchId);
    if (!matchSets || matchSets.length === 0) return null;
    return matchSets.map((s) => `${s.a}-${s.b}`).join(', ');
  };

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
  const categoryLevels = new Map((categories ?? []).map((c) => [c.id, c.level]));

  // Etiqueta de fase per a la línia de detall: nom de la ronda per a
  // eliminatòries ("Semifinal", "Final de consolació"...), o "group (A)" com
  // fins ara per a la fase de grups.
  const phaseDetail = (m: { phase: string; category_id: string; group_label: string | null }) => {
    const round = phaseRoundText(m.phase, categoryLevels.get(m.category_id), locale);
    if (round) return round;
    return `${m.phase} ${m.group_label ? `(${m.group_label})` : ''}`.trim();
  };

  const phaseFilterHref = (phase?: string) => {
    const params = new URLSearchParams();
    if (sp.category) params.set('category', sp.category);
    if (matchStatus) params.set('status', matchStatus);
    if (phase) params.set('phase', phase);
    const qs = params.toString();
    return `/${locale}/admin/matches${qs ? `?${qs}` : ''}`;
  };

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

        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              [undefined, t('filter_phase_all')],
              ['group', t('filter_phase_groups')],
              ['ko', t('filter_phase_ko')],
            ] as const
          ).map(([phase, label]) => (
            <a
              key={label}
              href={phaseFilterHref(phase)}
              className={
                (sp.phase ?? undefined) === phase
                  ? 'rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-[hsl(var(--primary-foreground))]'
                  : 'rounded-md border border-[hsl(var(--border))] px-3 py-1'
              }
            >
              {label}
            </a>
          ))}
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
                      {categoriesById.get(m.category_id) ?? ''} · {phaseDetail(m)} ·{' '}
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
                {scoreText(m.id) && (
                  <p className="font-mono text-sm font-medium">{scoreText(m.id)}</p>
                )}
                <ScheduleForm
                  matchId={m.id}
                  scheduledAt={m.scheduled_at}
                  courtLabel={m.court_label}
                />
                <div className="flex flex-wrap gap-2">
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
                  <EditScoreButton matchId={m.id} initialSets={setsByMatch.get(m.id) ?? []} />
                  {/* Anul·lar només té sentit si el partit ja s'ha "jugat" en
                      algun sentit (té resultat, disputa o report pendent) —
                      un 'scheduled' net encara no té res a desfer. */}
                  {m.status !== 'scheduled' && <AnnulMatchButton matchId={m.id} />}
                </div>
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
