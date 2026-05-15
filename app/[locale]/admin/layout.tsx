import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { LayoutDashboard, Wallet, Settings } from 'lucide-react';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login?next=/${locale}/admin`);

  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role !== 'admin') {
    redirect(`/${locale}?error=forbidden`);
  }

  const t = await getTranslations('admin');

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-6 py-8">
      <aside className="w-48 space-y-1 text-sm">
        <p className="text-muted-foreground mb-3 text-xs tracking-wider uppercase">
          {t('sidebar_title')}
        </p>
        <NavLink href={`/${locale}/admin`} icon={<LayoutDashboard className="size-4" />}>
          {t('nav_dashboard')}
        </NavLink>
        <NavLink href={`/${locale}/admin/payments`} icon={<Wallet className="size-4" />}>
          {t('nav_payments')}
        </NavLink>
        <NavLink href={`/${locale}/admin/settings`} icon={<Settings className="size-4" />}>
          {t('nav_settings')}
        </NavLink>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[hsl(var(--accent))]"
    >
      {icon}
      {children}
    </Link>
  );
}
