import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { AdminRegistrationForm } from '../admin-registration-form';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function NewRegistrationPage({ params }: Props) {
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
    .order('level', { ascending: true });

  if (!tournament || !categories || categories.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">{t('registrations_new_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('registrations_no_tournament')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        href={`/${locale}/admin/registrations`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('registrations_back_to_list')}
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{t('registrations_new_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('registrations_new_subtitle')}</p>
      </header>

      <AdminRegistrationForm
        tournamentId={tournament.id}
        locale={locale}
        categories={categories.map((c) => ({
          id: c.id,
          level: c.level,
          label: locale === 'ca' ? c.name_ca : c.name_es,
        }))}
      />
    </section>
  );
}
