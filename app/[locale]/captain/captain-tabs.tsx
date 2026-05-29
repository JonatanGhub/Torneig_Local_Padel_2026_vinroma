'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Tab = { href: string; label: string };

export function CaptainTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const homeHref = tabs[0]?.href ?? '';

  return (
    <div className="bg-ink-950/85 sticky top-[57px] z-30 border-b border-white/10 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-6"
        aria-label="Captain sections"
      >
        {tabs.map((tab) => {
          const isHome = tab.href === homeHref;
          const isActive = isHome
            ? pathname === tab.href
            : pathname === tab.href || pathname?.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'border-crimson-500 text-white'
                  : 'border-transparent text-white/55 hover:text-white',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
