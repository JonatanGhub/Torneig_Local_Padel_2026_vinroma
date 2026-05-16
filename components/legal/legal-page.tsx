import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Layout reutilizable para páginas legales (privacidad, cookies, aviso legal).
 * Estética coherente con el landing: fondo oscuro + tipografía display.
 */
export function LegalPage({
  locale,
  title,
  updatedAt,
  children,
}: {
  locale: string;
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-ink-950 relative min-h-screen overflow-hidden text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href={`/${locale}`}
          className="mb-8 inline-flex items-center gap-1 text-sm text-white/55 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {locale === 'ca' ? 'Inici' : 'Inicio'}
        </Link>
        <header className="mb-10">
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-2 text-xs tracking-widest text-white/55 uppercase">{updatedAt}</p>
        </header>
        <article className="prose-legal space-y-6 text-white/80">{children}</article>
      </main>
    </div>
  );
}
