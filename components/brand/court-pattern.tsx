import { cn } from '@/lib/utils';

/**
 * Padel court ilustrativa para fondos decorativos.
 * Generada en SVG (sin foto real de jugadores, coherente con §21.6).
 */
export function CourtBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-full w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="courtBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.55 0.16 152)" />
          <stop offset="100%" stopColor="oklch(0.36 0.14 152)" />
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="oklch(0.85 0.1 95 / 0.18)" />
          <stop offset="100%" stopColor="oklch(0.85 0.1 95 / 0)" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#courtBg)" />
      <rect width="400" height="200" fill="url(#spot)" />
      <g stroke="oklch(1 0 0 / 0.7)" strokeWidth="0.9" fill="none" transform="translate(50 25)">
        <rect width="300" height="150" rx="3" />
        <line x1="150" y1="0" x2="150" y2="150" />
        <line x1="0" y1="50" x2="300" y2="50" />
        <line x1="0" y1="100" x2="300" y2="100" />
        <line x1="150" y1="50" x2="150" y2="100" strokeDasharray="2 3" opacity="0.65" />
        <line x1="-4" y1="0" x2="-4" y2="150" strokeOpacity="0.4" />
        <line x1="304" y1="0" x2="304" y2="150" strokeOpacity="0.4" />
      </g>
    </svg>
  );
}
