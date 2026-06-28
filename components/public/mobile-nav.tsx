'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import type { Locale } from '@/i18n';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

type NavItem = { href: string; label: string };

/**
 * Menú de navegació per a mòbil/tablet. Al landing, la <nav> de PC està
 * amagada amb `hidden md:flex`, de manera que en pantalles petites no hi havia
 * cap manera d'arribar a Grups/Quadre/Calendari/Reglament. Aquest component
 * mostra un botó hamburguesa (només < md) que desplega els mateixos enllaços.
 */
export function MobileNav({
  locale,
  links,
  loginLabel,
}: {
  locale: Locale;
  links: NavItem[];
  loginLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <>
          {/* Catifa per tancar en tocar fora */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="liquid-glass-dark absolute right-4 left-4 z-50 mt-3 flex flex-col gap-1 rounded-2xl p-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}

            <div className="my-1 h-px bg-white/10" />

            <div className="flex items-center justify-between px-2 py-1">
              <LocaleSwitcher current={locale} />
              <ThemeToggle variant="dark" />
            </div>

            <Link
              href={`/${locale}/login`}
              onClick={() => setOpen(false)}
              className="text-ink-900 mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold"
            >
              {loginLabel}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
