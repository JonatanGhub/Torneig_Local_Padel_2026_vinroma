import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { getCategoryCounts } from '@/lib/category-capacity';
import { getTournamentFees } from '@/lib/pricing';
import { FeesSchedule } from '@/components/public/fees-schedule';
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
    .select(
      'id, slug, name_ca, name_es, registration_opens_at, registration_closes_at, is_published',
    )
    .eq('edition', 5)
    .maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es, max_pairs')
    .eq('tournament_id', tournament?.id ?? '')
    .order('level', { ascending: true });

  const counts = tournament ? await getCategoryCounts(supabase, tournament.id) : new Map();
  const fees = tournament ? await getTournamentFees(supabase, tournament.id) : [];

  const now = Date.now();
  const opensAt = tournament ? new Date(tournament.registration_opens_at).getTime() : null;
  const closesAt = tournament ? new Date(tournament.registration_closes_at).getTime() : null;
  const isPublished = tournament?.is_published === true;
  const beforeOpen = opensAt !== null && now < opensAt;
  const afterClose = closesAt !== null && now > closesAt;
  const windowOpen = isPublished && !beforeOpen && !afterClose;

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  });

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

      {fees.length > 0 && (
        <div className="mb-6">
          <FeesSchedule fees={fees} locale={locale} />
        </div>
      )}

      {tournament && categories && categories.length > 0 && windowOpen ? (
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
      ) : afterClose ? (
        <div className="border-border space-y-2 rounded-md border p-6">
          <p className="font-medium">{t('registration.closed_title')}</p>
          <p className="text-muted-foreground text-sm">{t('registration.closed_subtitle')}</p>
          {closesAt !== null && (
            <p className="text-muted-foreground text-xs">
              {t('registration.closed_at', { date: dateFormatter.format(closesAt) })}
            </p>
          )}
        </div>
      ) : beforeOpen ? (
        <div className="border-border space-y-2 rounded-md border p-6">
          <p className="font-medium">{t('registration.opens_title')}</p>
          {opensAt !== null && (
            <p className="text-muted-foreground text-sm">
              {t('registration.opens_at', { date: dateFormatter.format(opensAt) })}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t('registration.not_open_yet')}</p>
      )}
    </main>
  );
}
