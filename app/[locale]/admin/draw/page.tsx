import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { BracketPreviewCard } from '@/components/bracket-preview-card';
import { DrawForms } from './draw-forms';

type Props = { params: Promise<{ locale: Locale }> };

export default async function DrawAdminPage({ params }: Props) {
  const { locale } = await params;
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

  const { data: groups } = await supabase
    .from('groups')
    .select('id, category_id, label, draw_seed, drawn_at')
    .eq('tournament_id', tournament?.id ?? '');

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, category_id, status, group_id')
    .eq('tournament_id', tournament?.id ?? '');

  const { data: matches } = await supabase
    .from('matches')
    .select('category_id, phase, status')
    .eq('tournament_id', tournament?.id ?? '');

  const summary = (categories ?? []).map((c) => {
    const catPairs = (pairs ?? []).filter((p) => p.category_id === c.id);
    const confirmed = catPairs.filter((p) => p.status === 'confirmed');
    const inDraw = catPairs.filter((p) => p.group_id !== null);
    const catGroups = (groups ?? []).filter((g) => g.category_id === c.id);
    const catMatches = (matches ?? []).filter((m) => m.category_id === c.id);
    const groupMatches = catMatches.filter((m) => m.phase === 'group');
    const groupMatchesDone = groupMatches.filter(
      (m) => m.status === 'validated' || m.status === 'walkover',
    ).length;
    const koGenerated = catMatches.some(
      (m) => m.phase.startsWith('ko_') || m.phase.startsWith('cons_'),
    );
    return {
      id: c.id,
      level: c.level,
      label: locale === 'ca' ? c.name_ca : c.name_es,
      confirmedCount: confirmed.length,
      inDrawCount: inDraw.length,
      groupCount: catGroups.length,
      drawSeed: catGroups[0]?.draw_seed ?? null,
      drawnAt: catGroups[0]?.drawn_at ?? null,
      groupMatchesTotal: groupMatches.length,
      groupMatchesDone,
      groupPhaseFinished: groupMatches.length > 0 && groupMatchesDone === groupMatches.length,
      koGenerated,
    };
  });

  // Vista prèvia del cuadre per categories ja sortejades però amb KO no
  // generat. Es basa en la classificació actual i marca amb '*' les posicions
  // que encara poden canviar (grup no acabat).
  const drawnCategoryIds = (groups ?? []).map((g) => g.category_id);
  const { data: standingsRows } = drawnCategoryIds.length
    ? await supabase
        .from('category_standings')
        .select(
          'pair_id, category_id, group_id, matches_played, matches_won, sets_diff, games_diff',
        )
        .in('category_id', drawnCategoryIds)
    : { data: [] };

  // Etiquetes de parella per a la prèvia (Last / Last).
  const previewPairIds = Array.from(new Set((standingsRows ?? []).map((s) => s.pair_id)));
  const { data: previewPairs } = previewPairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', previewPairIds)
    : { data: [] };
  const previewPlayerIds = (previewPairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: previewPlayers } = previewPlayerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', previewPlayerIds)
    : { data: [] };
  const lastNameMap = new Map((previewPlayers ?? []).map((p) => [p.id, fullName(p)]));
  const pairLabels = new Map<string, string>();
  for (const p of previewPairs ?? []) {
    pairLabels.set(
      p.id,
      `${lastNameMap.get(p.player_a_id) ?? '—'} / ${lastNameMap.get(p.player_b_id) ?? '—'}`,
    );
  }

  const previewsByCategory: Record<string, React.ReactNode> = {};
  for (const cat of summary) {
    if (!(cat.groupCount > 0) || cat.koGenerated) continue;
    const catStandings = (standingsRows ?? []).filter((s) => s.category_id === cat.id);
    const catGroupsInfo = (groups ?? [])
      .filter((g) => g.category_id === cat.id)
      .map((g) => {
        // Total de partits del grup = combinacions de parelles del grup.
        // Played: cada partit jugat compta dues vegades a la vista de
        // standings (un cop per cada parella), per això dividim entre 2.
        const pairsInGroup = catStandings.filter((s) => s.group_id === g.id).length;
        const total = pairsInGroup >= 2 ? (pairsInGroup * (pairsInGroup - 1)) / 2 : 0;
        const played =
          catStandings
            .filter((s) => s.group_id === g.id)
            .reduce((acc, s) => acc + Number(s.matches_played ?? 0), 0) / 2;
        return {
          id: g.id,
          label: g.label,
          total_matches: total,
          played_matches: Math.round(played),
        };
      });
    previewsByCategory[cat.id] = (
      <BracketPreviewCard
        standings={catStandings.map((s) => ({
          pair_id: s.pair_id,
          group_id: s.group_id,
          matches_played: Number(s.matches_played ?? 0),
          matches_won: Number(s.matches_won ?? 0),
          sets_diff: Number(s.sets_diff ?? 0),
          games_diff: Number(s.games_diff ?? 0),
        }))}
        groups={catGroupsInfo}
        pairLabels={pairLabels}
        locale={locale}
        labels={{
          title: t('bracket_preview_title'),
          subtitle: t('bracket_preview_subtitle'),
          main: t('bracket_preview_main'),
          consolation: t('bracket_preview_consolation'),
          finished_badge: t('bracket_preview_finished_badge'),
          preliminary_badge: t('bracket_preview_preliminary_badge'),
          not_feasible: t('bracket_preview_not_feasible'),
        }}
      />
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('draw_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('draw_subtitle')}</p>
      </header>

      <DrawForms summary={summary} previewsByCategory={previewsByCategory} />
    </section>
  );
}
