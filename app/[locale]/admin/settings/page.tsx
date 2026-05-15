import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from './form';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('club_settings')
    .select(
      'id, legal_name, cif, address, email, bizum_phone, iban, contact_person_name, contact_person_phone',
    )
    .maybeSingle();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('settings_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settings_subtitle')}</p>
      </header>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-destructive text-sm">{t('settings_not_found')}</p>
      )}
    </section>
  );
}
