import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LoginForm } from './login-form';
import type { Locale } from '@/i18n';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const next = sp.next && sp.next.startsWith('/') ? sp.next : null;
  const showAuthError = sp.error === 'auth';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.login_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('auth.login_subtitle')}</p>
        </div>

        {showAuthError && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {t('auth.link_failed_use_code')}
          </div>
        )}

        <LoginForm next={next} />

        <p className="text-muted-foreground text-center text-xs">
          <Link href="/" className="hover:text-foreground">
            ← {t('common.back')}
          </Link>
        </p>
      </div>
    </main>
  );
}
