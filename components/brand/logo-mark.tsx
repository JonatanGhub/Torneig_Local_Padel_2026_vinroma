import { cn } from '@/lib/utils';

/**
 * Logo del Club Pàdel Les Coves de Vinromà.
 * Composición: cuatro puntos redondos a la izquierda (negro/blanco/rojo) + texto.
 * Sin imagen, todo SVG — escala perfecta en cualquier tamaño.
 */
export function LogoMark({ className, size = 56 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('drop-shadow-md', className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="dotGloss" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.55)" />
          <stop offset="60%" stopColor="oklch(1 0 0 / 0)" />
        </radialGradient>
      </defs>
      {/* 4 puntos en 2x2: negro, rojo / rojo, blanco */}
      <circle cx="20" cy="20" r="10" fill="oklch(0.1 0 0)" />
      <circle cx="20" cy="20" r="10" fill="url(#dotGloss)" />
      <circle cx="44" cy="20" r="10" fill="oklch(0.56 0.22 25)" />
      <circle cx="44" cy="20" r="10" fill="url(#dotGloss)" />
      <circle cx="20" cy="44" r="10" fill="oklch(0.56 0.22 25)" />
      <circle cx="20" cy="44" r="10" fill="url(#dotGloss)" />
      <circle
        cx="44"
        cy="44"
        r="10"
        fill="oklch(0.98 0 0)"
        stroke="oklch(0.12 0 0 / 0.18)"
        strokeWidth="0.8"
      />
      <circle cx="44" cy="44" r="10" fill="url(#dotGloss)" opacity="0.5" />
    </svg>
  );
}

/**
 * Lockup horizontal: cuatro puntos + texto a la derecha.
 * Variante por defecto sobre fondo oscuro (texto blanco).
 */
export function LogoLockup({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark size={40} />
      <div className="leading-tight">
        <p
          className={cn(
            'font-display text-base font-semibold tracking-tight',
            inverted ? 'text-ink-900' : 'text-white',
          )}
        >
          V Torneig de Pàdel
        </p>
        <p
          className={cn(
            'text-[10px] font-medium tracking-[0.18em] uppercase',
            inverted ? 'text-ink-600' : 'text-white/65',
          )}
        >
          Les Coves de Vinromà · 2026
        </p>
      </div>
    </div>
  );
}
