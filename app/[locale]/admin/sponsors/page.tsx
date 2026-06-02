import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { SponsorList } from './sponsor-list';
import { SponsorRequestsList, type SponsorRequest } from './sponsor-requests';

type Props = { params: Promise<{ locale: Locale }> };

export default async function SponsorsAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const [sponsorsResp, requestsResp] = await Promise.all([
    supabase
      .from('sponsors')
      .select('id, name, logo_url, website_url, tier, display_order, is_active, role_ca, role_es')
      .order('is_active', { ascending: false })
      .order('tier', { ascending: true })
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('sponsor_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">{t('sponsors_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('sponsors_subtitle')}</p>
      </header>
      <SponsorRequestsList requests={(requestsResp.data ?? []) as SponsorRequest[]} />
      <SponsorList sponsors={sponsorsResp.data ?? []} />
    </section>
  );
}
