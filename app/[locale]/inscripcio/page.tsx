import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { getCategoryCounts } from '@/lib/category-capacity';
import { RegistrationWizard } from './wizard';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function InscripcioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, slug, name_ca, name_es, registration_opens_at, registration_closes_at')
    .eq('edition', 5)
    .maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es, max_pairs')
    .eq('tournament_id', tournament?.id ?? '')
    .order('level', { ascending: true });

  const counts = tournament ? await getCategoryCounts(supabase, tournament.id) : new Map();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('registration.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('registration.subtitle')}</p>
      </header>

      {tournament && categories && categories.length > 0 ? (
        <RegistrationWizard
          tournamentId={tournament.id}
          categories={categories.map((c) => ({
            id: c.id,
            level: c.level,
            label: locale === 'ca' ? c.name_ca : c.name_es,
            maxPairs: c.max_pairs,
            usedPairs: counts.get(c.id) ?? 0,
          }))}
          locale={locale}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t('registration.not_open_yet')}</p>
      )}
    </main>
  );
}
