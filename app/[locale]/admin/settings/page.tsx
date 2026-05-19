import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { getCategoryCounts } from '@/lib/category-capacity';
import { SettingsForm } from './form';
import { CategoryCapacityForm } from './category-capacity-form';

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
    supabase.from('tournaments').select('id').eq('edition', 5).maybeSingle(),
  ]);

  let categories: {
    id: string;
    level: number;
    label: string;
    maxPairs: number;
    usedPairs: number;
  }[] = [];
  if (tournament) {
    const [{ data: rows }, counts] = await Promise.all([
      supabase
        .from('categories')
        .select('id, level, name_ca, name_es, max_pairs')
        .eq('tournament_id', tournament.id)
        .order('level', { ascending: true }),
      getCategoryCounts(supabase, tournament.id),
    ]);
    categories = (rows ?? []).map((c) => ({
      id: c.id,
      level: c.level,
      label: locale === 'ca' ? c.name_ca : c.name_es,
      maxPairs: c.max_pairs,
      usedPairs: counts.get(c.id) ?? 0,
    }));
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

      {categories.length > 0 && (
        <div className="border-border border-t pt-8">
          <CategoryCapacityForm categories={categories} />
        </div>
      )}
    </section>
  );
}
