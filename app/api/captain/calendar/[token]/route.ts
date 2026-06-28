import { createServiceClient } from '@/lib/supabase/service';
import { fullName } from '@/lib/player-name';
import { buildIcsCalendar, type IcalMatch } from '@/lib/ical';

const MATCH_DURATION_MINUTES = 90;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  if (!UUID_REGEX.test(token)) {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get('lang') === 'es' ? 'es' : 'ca';

  const supabase = createServiceClient();

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('calendar_feed_token', token)
    .maybeSingle();

  if (!player) {
    return new Response('Not found', { status: 404 });
  }

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, category_id')
    .or(`player_a_id.eq.${player.id},player_b_id.eq.${player.id}`);

  const pairIds = (pairs ?? []).map((p) => p.id);
  if (pairIds.length === 0) {
    return new Response(buildEmptyCalendar(player, locale), icsHeaders());
  }

  const orFilter = pairIds.map((id) => `pair_a_id.eq.${id},pair_b_id.eq.${id}`).join(',');
  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status',
    )
    .or(orFilter);

  const scheduledMatches = (matches ?? []).filter((m) => m.scheduled_at);
  if (scheduledMatches.length === 0) {
    return new Response(buildEmptyCalendar(player, locale), icsHeaders());
  }

  const rivalPairIds = Array.from(
    new Set(
      scheduledMatches.map((m) => (pairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id)),
    ),
  );

  const { data: rivalPairs } = await supabase
    .from('pairs')
    .select('id, player_a_id, player_b_id')
    .in('id', rivalPairIds);

  const rivalPlayerIds = (rivalPairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: rivalPlayers } = rivalPlayerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', rivalPlayerIds)
    : { data: [] };
  const playerMap = new Map((rivalPlayers ?? []).map((p) => [p.id, p]));
  const pairLabelMap = new Map(
    (rivalPairs ?? []).map((p) => {
      const a = playerMap.get(p.player_a_id);
      const b = playerMap.get(p.player_b_id);
      const label = `${fullName(a)} / ${fullName(b)}`;
      return [p.id, label];
    }),
  );

  const categoryIds = Array.from(new Set(scheduledMatches.map((m) => m.category_id)));
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name_ca, name_es')
    .in('id', categoryIds);
  const categoryLabelMap = new Map(
    (categories ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  const t = translations(locale);

  const icsMatches: IcalMatch[] = scheduledMatches.map((m) => {
    const rivalPairId = pairIds.includes(m.pair_a_id) ? m.pair_b_id : m.pair_a_id;
    const rivalLabel = pairLabelMap.get(rivalPairId) ?? '—';
    const categoryLabel = categoryLabelMap.get(m.category_id) ?? '';
    const phaseLabel = m.group_label ? `${t.group} ${m.group_label}` : (m.phase ?? '');
    const courtLabel = m.court_label ?? t.courtTbd;
    const status: 'confirmed' | 'cancelled' = m.status === 'walkover' ? 'cancelled' : 'confirmed';

    const descriptionParts = [categoryLabel, phaseLabel, `${t.court}: ${courtLabel}`].filter(
      Boolean,
    );

    return {
      id: m.id,
      scheduledAt: m.scheduled_at!,
      durationMinutes: MATCH_DURATION_MINUTES,
      summary: `${t.summaryPrefix}: ${t.vs} ${rivalLabel}`,
      description: descriptionParts.join(' · '),
      location: `${courtLabel} · ${t.venue}`,
      status,
    };
  });

  const ics = buildIcsCalendar({
    name: t.calName(player.first_name ?? ''),
    description: t.calDesc,
    timezone: 'Europe/Madrid',
    matches: icsMatches,
  });

  return new Response(ics, icsHeaders());
}

function icsHeaders() {
  // Sense Content-Disposition: alguns clients (incloent Google Calendar
  // "add by URL") rebutgen el feed quan veuen `inline; filename=...` perquè
  // l'interpreten com a descàrrega de fitxer i no com a flux de calendari.
  return {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  };
}

function buildEmptyCalendar(player: { first_name: string | null }, locale: 'ca' | 'es') {
  const t = translations(locale);
  return buildIcsCalendar({
    name: t.calName(player.first_name ?? ''),
    description: t.calDesc,
    timezone: 'Europe/Madrid',
    matches: [],
  });
}

function translations(locale: 'ca' | 'es') {
  if (locale === 'es') {
    return {
      summaryPrefix: 'Pádel les Coves',
      vs: 'vs',
      group: 'Grupo',
      court: 'Pista',
      courtTbd: 'sin pista',
      venue: 'Club Pádel les Coves de Vinromà',
      calName: (name: string) =>
        name ? `Pádel Vinromà — ${name}` : 'V Torneo Pádel les Coves de Vinromà',
      calDesc: 'Partidos del torneo. Se actualiza automáticamente al cambiar el calendario.',
    };
  }
  return {
    summaryPrefix: 'Pàdel les Coves',
    vs: 'vs',
    group: 'Grup',
    court: 'Pista',
    courtTbd: 'sense pista',
    venue: 'Club Pàdel les Coves de Vinromà',
    calName: (name: string) =>
      name ? `Pàdel Vinromà — ${name}` : 'V Torneig Pàdel les Coves de Vinromà',
    calDesc: "Partits del torneig. S'actualitza automàticament en canviar el calendari.",
  };
}
