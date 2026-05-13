import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LoginForm } from './login-form';
import type { Locale } from '@/i18n';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.login_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('auth.login_subtitle')}</p>
        </div>

        <LoginForm />

        <p className="text-muted-foreground text-center text-xs">
          <Link href="/" className="hover:text-foreground">
            ← {t('common.back')}
          </Link>
        </p>
      </div>
    </main>
  );
}
