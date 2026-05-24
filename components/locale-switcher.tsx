'use client';

import { usePathname } from 'next/navigation';
import { useTransition } from 'react';

const LOCALES = ['ca', 'es'] as const;
const DEFAULT_LOCALE = 'ca';
type Loc = (typeof LOCALES)[number];

// Switcher robust per a localePrefix: 'as-needed'. Fixa la cookie NEXT_LOCALE
// (sinó el middleware torna a redirigir a l'idioma anterior) i conserva la
// ruta actual. Navegació "dura" perquè el middleware reavaluï amb la cookie nova.
export function LocaleSwitcher({
  current,
  className,
  tone = 'dark',
}: {
  current: Loc;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(target: Loc) {
    if (target === current || isPending) return;

    let rest = pathname || '/';
    for (const l of LOCALES) {
      if (rest === `/${l}`) {
        rest = '/';
        break;
      }
      if (rest.startsWith(`/${l}/`)) {
        rest = rest.slice(l.length + 1);
        break;
      }
    }
    const dest = target === DEFAULT_LOCALE ? rest : `/${target}${rest === '/' ? '' : rest}`;

    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      window.location.assign(dest || '/');
    });
  }

  const base =
    tone === 'dark'
      ? 'text-white/55 hover:text-white'
      : 'text-muted-foreground hover:text-foreground';
  const active = tone === 'dark' ? 'text-white' : 'text-foreground';

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-medium ${className ?? ''}`}>
      {LOCALES.map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 && <span className="mx-1 opacity-30">·</span>}
          <button
            type="button"
            onClick={() => switchTo(l)}
            aria-current={l === current ? 'true' : undefined}
            className={`uppercase transition-colors ${l === current ? active : base}`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
