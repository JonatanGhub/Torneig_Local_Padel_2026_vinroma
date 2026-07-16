import { Trophy } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import {
  KnockoutBracket,
  defaultBracketLabels,
  type BracketMatch,
  type BracketSet,
} from '@/components/public/knockout-bracket';
import { buildBracketProjectionCards } from '@/lib/bracket-projection';
import { BracketProjectionCards } from '@/components/bracket/bracket-projection-cards';
import { loadCaptainContext } from '@/lib/captain/data';
import { NoProfilePanel } from '../no-profile-panel';

type Props = { params: Promise<{ locale: Locale }> };

export default async function CaptainQuadrePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ctx = await loadCaptainContext(locale);
  if (!ctx.player) return <NoProfilePanel locale={locale} />;

  const supabase = await createClient();
  const { myPairs, myPairIds, pairLabels, categoryLabels } = ctx;

  const categoryIds = Array.from(
    new Set(myPairs.map((p) => p.category_id).filter((id): id is string => !!id)),
  );

  if (categoryIds.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Header
          eyebrow={t('captain.tab_bracket')}
          title={t('captain.bracket_page_title')}
          subtitle={t('captain.bracket_page_subtitle')}
        />
        <EmptyState title={t('captain.bracket_empty_title')} body={t('bracket.not_generated')} />
      </main>
    );
  }

  // Cap d'aquestes 5 consultes depèn del resultat de les altres (totes
  // necessiten com a molt `categoryIds`, ja conegut): es disparen alhora.
  const [
    { data: matchesData },
    { data: categoryRows },
    { data: projGroups },
    { data: projPairs },
    { data: projStandings },
    { data: projGroupMatches },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, category_id, phase, group_label, pair_a_id, pair_b_id, status, winner_pair_id, scheduled_at, court_label',
      )
      .in('category_id', categoryIds),
    supabase.from('categories').select('id, level, name_ca, name_es').in('id', categoryIds),
    supabase.from('groups').select('id, category_id, label').in('category_id', categoryIds),
    supabase
      .from('pairs')
      .select('id, category_id, group_id, player_a_id, player_b_id')
      .in('category_id', categoryIds)
      .not('group_id', 'is', null),
    supabase
      .from('category_standings')
      .select('pair_id, category_id, group_id, matches_played, matches_won, sets_diff, games_diff')
      .in('category_id', categoryIds),
    supabase
      .from('matches')
      .select('category_id, group_label, status')
      .eq('phase', 'group')
      .in('category_id', categoryIds),
  ]);

  const koMatches = (matchesData ?? []).filter(
    (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
  );

  const matchIds = koMatches.map((m) => m.id);
  // Top up pair labels for any new pair ids in the bracket.
  const allPairIds = Array.from(new Set(koMatches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
  const missing = allPairIds.filter((id) => !pairLabels.has(id));
  const projPlayerIds = Array.from(
    new Set((projPairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])),
  );

  // `setsData`, l'ompliment de pairLabels del quadre real que falten, i els
  // noms de totes les parelles amb grup (per a la previsió) són independents
  // entre si: es disparen alhora.
  const [{ data: setsData }, , { data: projNames }] = await Promise.all([
    matchIds.length
      ? supabase
          .from('sets')
          .select('match_id, set_number, games_a, games_b')
          .in('match_id', matchIds)
      : Promise.resolve({
          data: [] as { match_id: string; set_number: number; games_a: number; games_b: number }[],
        }),
    (async () => {
      if (missing.length === 0) return;
      const { data: extra } = await supabase
        .from('pairs')
        .select('id, player_a_id, player_b_id')
        .in('id', missing);
      const playerIds = (extra ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
      const { data: names } = playerIds.length
        ? await supabase
            .from('public_player_names')
            .select('id, first_name, last_name')
            .in('id', playerIds)
        : { data: [] };
      const nameMap = new Map((names ?? []).map((p) => [p.id, fullName(p)]));
      for (const p of extra ?? []) {
        pairLabels.set(
          p.id,
          `${nameMap.get(p.player_a_id) ?? '—'} / ${nameMap.get(p.player_b_id) ?? '—'}`,
        );
      }
    })(),
    projPlayerIds.length
      ? supabase
          .from('public_player_names')
          .select('id, first_name, last_name')
          .in('id', projPlayerIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
  ]);

  const projNameMap = new Map((projNames ?? []).map((p) => [p.id, fullName(p)]));
  for (const p of projPairs ?? []) {
    if (pairLabels.has(p.id)) continue;
    pairLabels.set(
      p.id,
      `${projNameMap.get(p.player_a_id) ?? '—'} / ${projNameMap.get(p.player_b_id) ?? '—'}`,
    );
  }

  const highlight = new Set(myPairIds);
  const bracketLabels = defaultBracketLabels(t);

  type KoWithCategory = BracketMatch & { category_id: string };
  const byCategory = new Map<string, KoWithCategory[]>();
  for (const m of koMatches as KoWithCategory[]) {
    const list = byCategory.get(m.category_id) ?? [];
    list.push(m);
    byCategory.set(m.category_id, list);
  }

  // Per a les categories que encara NO tenen quadre real generat, mostrem
  // com quedaria l'eliminatòria amb els resultats/classificacions actuals
  // (igual que la previsió de la web pública), perquè el capità no hagi
  // d'esperar al sorteig del quadre per fer-se'n una idea.
  const categoriesNeedingProjection = new Set(categoryIds.filter((id) => !byCategory.has(id)));
  const projectionCards = buildBracketProjectionCards(
    locale,
    (categoryRows ?? []).filter((c) => categoriesNeedingProjection.has(c.id)),
    projGroups ?? [],
    projPairs ?? [],
    projStandings ?? [],
    projGroupMatches ?? [],
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Header
        eyebrow={t('captain.tab_bracket')}
        title={t('captain.bracket_page_title')}
        subtitle={t('captain.bracket_page_subtitle')}
      />
      {Array.from(byCategory.entries()).map(([categoryId, matches]) => (
        <section key={categoryId} className="mb-12">
          <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight">
            {categoryLabels.get(categoryId) ?? ''}
          </h2>
          <KnockoutBracket
            matches={matches}
            sets={((setsData as BracketSet[] | null) ?? []).filter((s) =>
              matches.some((m) => m.id === s.match_id),
            )}
            pairLabel={(id) => pairLabels.get(id) ?? '—'}
            highlightPairIds={highlight}
            locale={locale}
            labels={bracketLabels}
          />
        </section>
      ))}
      {projectionCards.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight">
            {t('captain.bracket_projection_title')}
          </h2>
          <p className="text-muted-foreground mb-4 text-sm dark:text-white/55">
            {t('captain.bracket_projection_subtitle')}
          </p>
          <BracketProjectionCards
            cards={projectionCards}
            locale={locale}
            pairLabel={(id) => pairLabels.get(id) ?? '—'}
            highlightPairIds={highlight}
            t={t}
          />
        </section>
      )}
      {categoryIds.every((id) => !byCategory.has(id)) && projectionCards.length === 0 && (
        <EmptyState title={t('captain.bracket_empty_title')} body={t('bracket.not_generated')} />
      )}
    </main>
  );
}

function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">{eyebrow}</p>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-white/65">{subtitle}</p>
    </header>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
      <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
        <Trophy className="size-6" />
      </div>
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/55">{body}</p>
    </div>
  );
}
