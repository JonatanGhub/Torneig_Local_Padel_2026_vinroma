import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

type Props = { params: Promise<{ locale: Locale; level: string }> };

export default async function BracketPage({ params }: Props) {
  const { locale, level: levelParam } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const level = Number.parseInt(levelParam, 10);
  if (!Number.isFinite(level) || level < 1 || level > 4) notFound();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) notFound();

  const { data: category } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es')
    .eq('tournament_id', tournament.id)
    .eq('level', level)
    .maybeSingle();
  if (!category) notFound();

  const { data: allMatches } = await supabase
    .from('matches')
    .select(
      'id, phase, group_label, pair_a_id, pair_b_id, status, winner_pair_id, scheduled_at, court_label',
    )
    .eq('category_id', category.id);

  const koMatches = ((allMatches as BracketMatch[] | null) ?? []).filter(
    (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
  );

  const pairIds = Array.from(new Set(koMatches.flatMap((m) => [m.pair_a_id, m.pair_b_id])));
  const matchIds = koMatches.map((m) => m.id);
  // `pairs` i `setsData` només depenen de koMatches (ja calculat): es
  // disparen alhora.
  const [{ data: pairs }, { data: setsData }] = await Promise.all([
    pairIds.length
      ? supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
      : Promise.resolve({ data: [] as { id: string; player_a_id: string; player_b_id: string }[] }),
    matchIds.length
      ? supabase
          .from('sets')
          .select('match_id, set_number, games_a, games_b')
          .in('match_id', matchIds)
      : Promise.resolve({
          data: [] as { match_id: string; set_number: number; games_a: number; games_b: number }[],
        }),
  ]);

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);

  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${fullName(a)} / ${fullName(b)}`;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
      <Link
        href={`/${locale}/quadre`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {locale === 'ca' ? category.name_ca : category.name_es}
      </h1>

      <KnockoutBracket
        matches={koMatches}
        sets={(setsData as BracketSet[] | null) ?? []}
        pairLabel={pairLabel}
        locale={locale}
        labels={defaultBracketLabels(t)}
      />
    </main>
  );
}
