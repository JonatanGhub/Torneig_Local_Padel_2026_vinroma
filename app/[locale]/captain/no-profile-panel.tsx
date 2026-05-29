import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';

export async function NoProfilePanel({ locale }: { locale: Locale }) {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6">
      <div className="glass-card w-full rounded-2xl p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">{t('captain.no_profile_title')}</h1>
        <p className="mt-2 text-sm text-white/65">{t('captain.no_profile_body')}</p>
        <Link
          href={`/${locale}`}
          className="bg-crimson-600 hover:bg-crimson-500 mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Link>
      </div>
    </main>
  );
}
