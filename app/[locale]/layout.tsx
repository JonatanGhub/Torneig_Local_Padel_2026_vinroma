import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { locales, type Locale } from '@/i18n';
import { HtmlLangUpdater } from './html-lang-updater';
import { CookiesBanner } from '@/components/legal/cookies-banner';
import { scheduleSelfHealCrons } from '@/lib/cron/self-heal';

function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isValidLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  // Xarxa de seguretat pels crons de WhatsApp (vegeu lib/cron/self-heal.ts):
  // no bloqueja ni alenteix aquesta resposta.
  scheduleSelfHealCrons();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <HtmlLangUpdater locale={locale} />
      {children}
      <CookiesBanner locale={locale} />
    </NextIntlClientProvider>
  );
}
