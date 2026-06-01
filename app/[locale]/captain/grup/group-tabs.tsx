'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type PairTab = { id: string; label: string };

export function CaptainGroupTabs({
  pairs,
  children,
  initialPairId,
}: {
  pairs: PairTab[];
  children: Record<string, React.ReactNode>;
  initialPairId?: string;
}) {
  const [active, setActive] = useState<string>(initialPairId ?? pairs[0]?.id ?? '');
  if (pairs.length === 0) return null;

  return (
    <div>
      {pairs.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {pairs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                active === p.id
                  ? 'border-crimson-500 bg-crimson-600/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/65 hover:text-white',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div>{children[active]}</div>
    </div>
  );
}
