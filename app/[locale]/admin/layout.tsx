import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  LayoutDashboard,
  Wallet,
  Settings,
  Shuffle,
  CalendarClock,
  AlertCircle,
  Heart,
  UserPlus,
  Mail,
  Home,
} from 'lucide-react';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from '@/components/logout-button';

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
    <div className="admin-shell mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] pb-4">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-base font-semibold hover:bg-[hsl(var(--accent))]"
        >
          <Home className="size-5" />
          {t('back_to_site')}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm tracking-wide uppercase sm:inline">
            {t('sidebar_title')}
          </span>
          <LocaleSwitcher current={locale} tone="light" />
          <ThemeToggle />
          <LogoutButton label={t('logout_short')} />
        </div>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="md:w-56 md:shrink-0">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-base md:mx-0 md:flex-col md:overflow-visible md:px-0">
            <NavLink href={`/${locale}/admin`} icon={<LayoutDashboard className="size-5" />}>
              {t('nav_dashboard')}
            </NavLink>
            <NavLink href={`/${locale}/admin/registrations`} icon={<UserPlus className="size-5" />}>
              {t('nav_registrations')}
            </NavLink>
            <NavLink href={`/${locale}/admin/payments`} icon={<Wallet className="size-5" />}>
              {t('nav_payments')}
            </NavLink>
            <NavLink href={`/${locale}/admin/draw`} icon={<Shuffle className="size-5" />}>
              {t('nav_draw')}
            </NavLink>
            <NavLink href={`/${locale}/admin/matches`} icon={<CalendarClock className="size-5" />}>
              {t('nav_matches')}
            </NavLink>
            <NavLink href={`/${locale}/admin/disputes`} icon={<AlertCircle className="size-5" />}>
              {t('nav_disputes')}
            </NavLink>
            <NavLink href={`/${locale}/admin/sponsors`} icon={<Heart className="size-5" />}>
              {t('nav_sponsors')}
            </NavLink>
            <NavLink href={`/${locale}/admin/interest`} icon={<Mail className="size-5" />}>
              {t('nav_interest')}
            </NavLink>
            <NavLink href={`/${locale}/admin/settings`} icon={<Settings className="size-5" />}>
              {t('nav_settings')}
            </NavLink>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 whitespace-nowrap hover:bg-[hsl(var(--accent))]"
    >
      {icon}
      {children}
    </Link>
  );
}
