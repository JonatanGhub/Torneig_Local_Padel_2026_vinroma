import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { InterestList } from './list';

type Props = { params: Promise<{ locale: Locale }> };

export default async function AdminInterestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  const { data: rows } = tournament
    ? await supabase
        .from('interest_subscriptions')
        .select('id, email, locale, source, created_at')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const subscriptions = rows ?? [];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('interest_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('interest_subtitle')}</p>
      </header>

      <InterestList subscriptions={subscriptions} locale={locale} />
    </section>
  );
}
