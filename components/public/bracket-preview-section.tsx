import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';
import { fullName } from '@/lib/player-name';
import { buildBracketProjectionCards } from '@/lib/bracket-projection';
import { BracketProjectionCards } from '@/components/bracket/bracket-projection-cards';

type Props = { locale: Locale };

export async function BracketPreviewSection({ locale }: Props) {
  const supabase = createPublicClient();
  const t = await getTranslations();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return null;

  // Cap d'aquestes 6 consultes depèn del resultat de les altres (totes
  // necessiten com a molt tournament.id): es disparen totes alhora.
  const [
    { data: categories },
    { data: groups },
    { data: pairs },
    { data: standings },
    { data: groupMatches },
    { data: schedule },
    { data: koProbe },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament.id)
      .order('level'),
    supabase.from('groups').select('id, category_id, label').eq('tournament_id', tournament.id),
    supabase
      .from('pairs')
      .select('id, category_id, group_id, player_a_id, player_b_id, status')
      .eq('tournament_id', tournament.id)
      .in('status', ['pending_payment', 'confirmed'])
      .not('group_id', 'is', null),
    supabase
      .from('category_standings')
      .select('pair_id, category_id, group_id, matches_played, matches_won, sets_diff, games_diff'),
    supabase
      .from('matches')
      .select('category_id, group_label, status')
      .eq('tournament_id', tournament.id)
      .eq('phase', 'group'),
    supabase
      .from('knockout_final_week_schedule')
      .select('category_level, bracket, round_number, position, match_date, match_time, court_label')
      .eq('round_number', 1),
    supabase
      .from('matches')
      .select('category_id, phase')
      .eq('tournament_id', tournament.id)
      .neq('phase', 'group'),
  ]);

  // Sense grups sortejats no hi ha res a previsualitzar.
  if (!groups || groups.length === 0) return null;

  // Etiquetes de parella (nom complet).
  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: names } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  const nameById = new Map((names ?? []).map((p) => [p.id, p]));
  const pairLabelById = new Map(
    (pairs ?? []).map((p) => [
      p.id,
      `${fullName(nameById.get(p.player_a_id))} / ${fullName(nameById.get(p.player_b_id))}`,
    ]),
  );

  // Categories amb quadre REAL ja generat: la previsió sobra (i podria
  // contradir-lo — p.ex. si l'organització ha reordenat encreuaments a mà).
  // El quadre real es veu a /quadre.
  const categoriesWithRealBracket = new Set(
    (koProbe ?? [])
      .filter((m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'))
      .map((m) => m.category_id),
  );

  // Construeix el quadre previst per a cada categoria (segons resultats/
  // classificacions actuals) — només les que encara no tenen quadre real.
  const cards = buildBracketProjectionCards(
    locale,
    (categories ?? []).filter((c) => !categoriesWithRealBracket.has(c.id)),
    groups ?? [],
    pairs ?? [],
    standings ?? [],
    groupMatches ?? [],
    schedule ?? [],
  );

  if (cards.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
            {t('landing.bracket_eyebrow')}
          </p>
          <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {t('landing.bracket_title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground dark:text-white/55">
            {t('landing.bracket_subtitle')}
          </p>
        </div>
      </div>

      <BracketProjectionCards
        cards={cards}
        locale={locale}
        pairLabel={(id) => pairLabelById.get(id) ?? '—'}
        t={t}
      />
    </section>
  );
}
