'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Slide = { src: string; alt: string };

/**
 * Cross-fade carousel de fotos reales de las pistas.
 * - Fundido largo y suave (~2.8 s) entre imágenes.
 * - Cada slide visible ~9 s.
 * - Sin fotos de personas (§21.6 RGPD ok: instalaciones).
 *
 * Las imágenes viven en /public/images/courts/{1,2,3}.png
 * Si faltan, el contenedor mantiene su gradiente de fondo.
 */
export function CourtCarousel({
  slides,
  className,
  intervalMs = 9000,
  fadeMs = 2800,
}: {
  slides: Slide[];
  className?: string;
  intervalMs?: number;
  fadeMs?: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Gradiente base por si las imágenes aún no están en /public */}
      <div
        aria-hidden
        className="from-crimson-900 via-ink-900 to-ink-950 absolute inset-0 bg-gradient-to-br"
      />

      {slides.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden={i !== active}
          className="absolute inset-0 ease-in-out"
          style={{
            opacity: i === active ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: `${fadeMs}ms`,
            willChange: 'opacity',
          }}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            priority={i === 0}
            className="object-cover"
          />
        </div>
      ))}

      {/* Capa de oscurecido + viñeta para legibilidad de overlays */}
      <div
        aria-hidden
        className="from-ink-950/70 to-ink-950/40 absolute inset-0 bg-gradient-to-t via-transparent"
      />

      {/* Indicadores */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-700',
                i === active ? 'w-8 bg-white' : 'w-1.5 bg-white/40',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
