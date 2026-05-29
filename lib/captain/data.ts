import { createClient } from '@/lib/supabase/server';

export type CaptainPlayer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  calendar_feed_token: string;
};

export type CaptainPair = {
  id: string;
  status: 'draft' | 'pending_payment' | 'confirmed' | 'withdrawn' | 'disqualified';
  category_id: string | null;
  group_id: string | null;
  player_a_id: string;
  player_b_id: string;
  captain_id: string;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
};

export type CaptainMatch = {
  id: string;
  category_id: string;
  phase: string;
  group_label: string | null;
  scheduled_at: string | null;
  court_label: string | null;
  pair_a_id: string;
  pair_b_id: string;
  status: 'scheduled' | 'pending_validation' | 'validated' | 'disputed' | 'walkover';
  winner_pair_id: string | null;
};

export type CaptainContext = {
  user: { id: string; email?: string | null } | null;
  player: CaptainPlayer | null;
  myPairs: CaptainPair[];
  myPairIds: string[];
  matches: CaptainMatch[];
  // pair_id -> "Last / Last" label (covers my pairs, rivals and group-mates).
  pairLabels: Map<string, string>;
  // category_id -> localized name.
  categoryLabels: Map<string, string>;
  // my pair_id -> partner full name ("First Last").
  partnerLabels: Map<string, string>;
};

const emptyCtx = (): CaptainContext => ({
  user: null,
  player: null,
  myPairs: [],
  myPairIds: [],
  matches: [],
  pairLabels: new Map(),
  categoryLabels: new Map(),
  partnerLabels: new Map(),
});

export async function loadCaptainContext(locale: 'ca' | 'es'): Promise<CaptainContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyCtx();

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name, calendar_feed_token')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!player) return { ...emptyCtx(), user };

  const { data: myPairsRaw } = await supabase
    .from('pairs')
    .select(
      'id, status, category_id, group_id, player_a_id, player_b_id, captain_id, withdrawn_at, withdrawal_reason',
    )
    .eq('captain_id', player.id);
  const myPairs: CaptainPair[] = (myPairsRaw ?? []) as CaptainPair[];
  const myPairIds = myPairs.map((p) => p.id);

  const { data: matchesRaw } = myPairIds.length
    ? await supabase
        .from('matches')
        .select(
          'id, category_id, phase, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status, winner_pair_id',
        )
        .or(myPairIds.map((id) => `pair_a_id.eq.${id},pair_b_id.eq.${id}`).join(','))
        .order('scheduled_at', { ascending: true, nullsFirst: true })
    : { data: [] };
  const matches: CaptainMatch[] = (matchesRaw ?? []) as CaptainMatch[];

  // Collect all pair IDs we need labels for: my pairs + their group-mates +
  // rivals from matches.
  const allPairIds = new Set<string>(myPairIds);
  for (const m of matches) {
    allPairIds.add(m.pair_a_id);
    allPairIds.add(m.pair_b_id);
  }

  const myGroupIds = Array.from(
    new Set(myPairs.map((p) => p.group_id).filter((id): id is string => !!id)),
  );
  if (myGroupIds.length) {
    const { data: groupPairs } = await supabase
      .from('pairs')
      .select('id')
      .in('group_id', myGroupIds);
    for (const p of groupPairs ?? []) allPairIds.add(p.id);
  }

  const { data: pairsData } = allPairIds.size
    ? await supabase
        .from('pairs')
        .select('id, player_a_id, player_b_id')
        .in('id', Array.from(allPairIds))
    : { data: [] };

  const partnerIds = Array.from(
    new Set(myPairs.map((p) => (p.player_a_id === player.id ? p.player_b_id : p.player_a_id))),
  );
  const allPlayerIds = Array.from(
    new Set([...(pairsData ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]), ...partnerIds]),
  );
  const { data: pubNames } = allPlayerIds.length
    ? await supabase.from('public_player_names').select('id, last_name').in('id', allPlayerIds)
    : { data: [] };
  const lastNameMap = new Map(pubNames?.map((p) => [p.id, p.last_name ?? '—']) ?? []);

  const { data: partnerRows } = partnerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', partnerIds)
    : { data: [] };
  const partnerNameById = new Map(
    (partnerRows ?? []).map((p) => [
      p.id,
      `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—',
    ]),
  );

  const pairLabels = new Map<string, string>();
  for (const p of pairsData ?? []) {
    const a = lastNameMap.get(p.player_a_id) ?? '—';
    const b = lastNameMap.get(p.player_b_id) ?? '—';
    pairLabels.set(p.id, `${a} / ${b}`);
  }

  const partnerLabels = new Map<string, string>();
  for (const p of myPairs) {
    const partnerId = p.player_a_id === player.id ? p.player_b_id : p.player_a_id;
    partnerLabels.set(p.id, partnerNameById.get(partnerId) ?? '—');
  }

  const { data: categories } = await supabase.from('categories').select('id, name_ca, name_es');
  const categoryLabels = new Map(
    (categories ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  return {
    user,
    player: player as CaptainPlayer,
    myPairs,
    myPairIds,
    matches,
    pairLabels,
    categoryLabels,
    partnerLabels,
  };
}
