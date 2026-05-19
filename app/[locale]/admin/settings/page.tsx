import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { getCategoryCounts } from '@/lib/category-capacity';
import { SettingsForm } from './form';
import { CategoryCapacityForm } from './category-capacity-form';
import { TournamentDatesForm } from './tournament-dates-form';
import { FeesForm, type Fee } from './fees-form';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  const [{ data: settings }, { data: tournament }] = await Promise.all([
    supabase
      .from('club_settings')
      .select(
        'id, legal_name, cif, address, email, bizum_phone, iban, contact_person_name, contact_person_phone',
      )
      .maybeSingle(),
    supabase
      .from('tournaments')
      .select(
        'id, registration_opens_at, registration_closes_at, draw_at, first_match_at, final_at, is_published',
      )
      .eq('edition', 5)
      .maybeSingle(),
  ]);

  let categories: {
    id: string;
    level: number;
    label: string;
    maxPairs: number;
    usedPairs: number;
  }[] = [];
  let fees: Fee[] = [];
  if (tournament) {
    const [{ data: rows }, counts, { data: feeRows }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, level, name_ca, name_es, max_pairs')
        .eq('tournament_id', tournament.id)
        .order('level', { ascending: true }),
      getCategoryCounts(supabase, tournament.id),
      supabase
        .from('tournament_fees')
        .select(
          'id, label_ca, label_es, starts_at, ends_at, amount_per_player_cents, is_default_open',
        )
        .eq('tournament_id', tournament.id)
        .order('starts_at', { ascending: true }),
    ]);
    categories = (rows ?? []).map((c) => ({
      id: c.id,
      level: c.level,
      label: locale === 'ca' ? c.name_ca : c.name_es,
      maxPairs: c.max_pairs,
      usedPairs: counts.get(c.id) ?? 0,
    }));
    fees = feeRows ?? [];
  }

  return (
    <section className="space-y-10">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">{t('settings_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings_subtitle')}</p>
        </header>

        {settings ? (
          <SettingsForm settings={settings} />
        ) : (
          <p className="text-destructive text-sm">{t('settings_not_found')}</p>
        )}
      </div>

      {tournament && (
        <div className="border-border border-t pt-8">
          <TournamentDatesForm tournament={tournament} />
        </div>
      )}

      {categories.length > 0 && (
        <div className="border-border border-t pt-8">
          <CategoryCapacityForm categories={categories} />
        </div>
      )}

      {tournament && (
        <div className="border-border border-t pt-8">
          <FeesForm tournamentId={tournament.id} fees={fees} />
        </div>
      )}
    </section>
  );
}
