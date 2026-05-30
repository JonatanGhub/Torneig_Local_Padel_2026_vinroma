'use client';

import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { signOutAndSwitchAccount } from '@/app/[locale]/(auth)/login/actions';
import { cn } from '@/lib/utils';

type Variant = 'light' | 'dark';

export function LogoutButton({
  label,
  variant = 'light',
  className,
}: {
  label: string;
  variant?: Variant;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const base =
    variant === 'dark'
      ? 'inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/10'
      : 'inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]';

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAndSwitchAccount())}
      className={cn(base, 'transition-colors disabled:opacity-50', className)}
    >
      <LogOut className="size-3.5" />
      {isPending ? '…' : label}
    </button>
  );
}
