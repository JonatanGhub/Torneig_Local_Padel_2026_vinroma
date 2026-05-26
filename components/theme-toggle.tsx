'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'light' | 'dark';

export function ThemeToggle({
  className,
  variant = 'light',
}: {
  className?: string;
  variant?: Variant;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  const base =
    variant === 'dark'
      ? 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/90 hover:bg-white/10'
      : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Activar mode clar' : 'Activar mode fosc'}
      aria-pressed={isDark}
      className={cn(base, 'transition-colors', className)}
    >
      {/* Render both icons but only one is visible to keep SSR markup stable. */}
      <Sun className={cn('size-4', mounted && isDark ? 'hidden' : 'block')} aria-hidden />
      <Moon className={cn('size-4', mounted && isDark ? 'block' : 'hidden')} aria-hidden />
    </button>
  );
}
