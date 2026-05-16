import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { SponsorList } from './sponsor-list';

type Props = { params: Promise<{ locale: Locale }> };

export default async function SponsorsAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('id, name, logo_url, website_url, tier, display_order, is_active')
    .order('is_active', { ascending: false })
    .order('tier', { ascending: true })
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('sponsors_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('sponsors_subtitle')}</p>
      </header>
      <SponsorList sponsors={sponsors ?? []} />
    </section>
  );
}
