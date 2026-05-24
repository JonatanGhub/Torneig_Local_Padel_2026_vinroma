import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
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

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('draw_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('draw_subtitle')}</p>
      </header>

      <DrawForms summary={summary} />
    </section>
  );
}
