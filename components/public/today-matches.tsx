import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';
import { fullName } from '@/lib/player-name';
import { MatchCard } from '@/components/match/match-card';
import { matchCardPhase } from '@/lib/phase-label';

type Props = {
  locale: Locale;
  title: string;
  emptyLabel: string;
};

// Returns the [start, end] UTC ISO timestamps that bracket "today" in Madrid.
function madridDayBoundsISO(now = new Date()): [string, string] {
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Madrid',
  });
  const ymd = dayFmt.format(now);
  const offFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'shortOffset',
    year: 'numeric',
  });
  const parts = offFmt.formatToParts(now);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00';
  const m = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offset = '+00:00';
  if (m && m[1] && m[2]) {
    const sign = m[1];
    const hh = m[2].padStart(2, '0');
    const mm = m[3] ?? '00';
    offset = `${sign}${hh}:${mm}`;
  }
  return [
    new Date(`${ymd}T00:00:00${offset}`).toISOString(),
    new Date(`${ymd}T23:59:59${offset}`).toISOString(),
  ];
}

export async function TodayMatches({ locale, title, emptyLabel }: Props) {
  const supabase = createPublicClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return null;

  const [startISO, endISO] = madridDayBoundsISO();

  // `matchesRaw` i `categories` només depenen de tournament.id: es disparen
  // alhora.
  const [{ data: matchesRaw }, { data: categories }] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id',
      )
      .eq('tournament_id', tournament.id)
      .gte('scheduled_at', startISO)
      .lte('scheduled_at', endISO)
      .in('status', ['scheduled', 'pending_validation'])
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name_ca, name_es, level')
      .eq('tournament_id', tournament.id),
  ]);

  const matches = matchesRaw ?? [];
  const categoryLabels = new Map(
    (categories ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );
  const categoryLevels = new Map((categories ?? []).map((c) => [c.id, c.level]));

  const pairIds = Array.from(new Set(matches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
  const { data: pairs } = pairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
    : { data: [] };
  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: names } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  const nameMap = new Map((names ?? []).map((p) => [p.id, fullName(p)]));
  const pairLabels = new Map<string, string>();
  for (const p of pairs ?? []) {
    pairLabels.set(
      p.id,
      `${nameMap.get(p.player_a_id) ?? '—'} / ${nameMap.get(p.player_b_id) ?? '—'}`,
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <h2 className="font-display mb-6 text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h2>
      {matches.length === 0 ? (
        <p className="text-sm text-white/55">{emptyLabel}</p>
      ) : (
        <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:overflow-visible md:px-0">
          <ul className="flex gap-3 md:grid md:grid-cols-2 md:gap-4">
            {matches.map((m) => (
              <li key={m.id} className="min-w-[280px] md:min-w-0">
                <MatchCard
                  category={categoryLabels.get(m.category_id) ?? ''}
                  groupLabel={m.group_label}
                  phase={matchCardPhase(m.phase, categoryLevels.get(m.category_id))}
                  pairALabel={pairLabels.get(m.pair_a_id) ?? '—'}
                  pairBLabel={pairLabels.get(m.pair_b_id) ?? '—'}
                  scheduledAt={m.scheduled_at}
                  courtLabel={m.court_label}
                  status={
                    m.status as
                      | 'scheduled'
                      | 'pending_validation'
                      | 'validated'
                      | 'disputed'
                      | 'walkover'
                  }
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
