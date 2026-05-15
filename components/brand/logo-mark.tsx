import { cn } from '@/lib/utils';

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
        <linearGradient id="courtGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.6 0.18 152)" />
          <stop offset="100%" stopColor="oklch(0.42 0.18 152)" />
        </linearGradient>
        <linearGradient id="ballGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.18 100)" />
          <stop offset="100%" stopColor="oklch(0.83 0.2 95)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#courtGrad)" />
      <line x1="32" y1="6" x2="32" y2="58" stroke="oklch(1 0 0 / 0.55)" strokeWidth="1.2" />
      <line x1="6" y1="22" x2="58" y2="22" stroke="oklch(1 0 0 / 0.45)" strokeWidth="1" />
      <line x1="6" y1="42" x2="58" y2="42" stroke="oklch(1 0 0 / 0.45)" strokeWidth="1" />
      <rect x="6" y="6" width="52" height="52" rx="10" fill="none" stroke="oklch(1 0 0 / 0.6)" strokeWidth="1.5" />
      <circle cx="44" cy="20" r="6.5" fill="url(#ballGrad)" />
      <path d="M 38.5 20 Q 44 14, 49.5 20" stroke="oklch(0.3 0.05 100)" strokeWidth="0.6" fill="none" opacity="0.6" />
      <path d="M 38.5 20 Q 44 26, 49.5 20" stroke="oklch(0.3 0.05 100)" strokeWidth="0.6" fill="none" opacity="0.6" />
    </svg>
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark size={44} />
      <div className="leading-tight">
        <p className="font-display text-base font-semibold tracking-tight">V Torneig de Pàdel</p>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          les Coves de Vinromà · 2026
        </p>
      </div>
    </div>
  );
}
