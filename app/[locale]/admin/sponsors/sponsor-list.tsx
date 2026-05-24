'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { deleteSponsor } from './actions';
import { SponsorForm } from './sponsor-form';

type Sponsor = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
  display_order: number;
  is_active: boolean;
  role_ca: string | null;
  role_es: string | null;
};

export function SponsorList({ sponsors }: { sponsors: Sponsor[] }) {
  const t = useTranslations('admin');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!window.confirm(t('sponsor_confirm_delete'))) return;
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      await deleteSponsor(fd);
    });
  }

  return (
    <div className="space-y-4">
      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))]"
        >
          <Plus className="size-4" />
          {t('sponsor_add')}
        </button>
      )}

      {creating && <SponsorForm onDone={() => setCreating(false)} />}

      {sponsors.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('sponsors_empty')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {sponsors.map((s) => (
            <li key={s.id} className="p-3 text-sm">
              {editingId === s.id ? (
                <SponsorForm sponsor={s} onDone={() => setEditingId(null)} />
              ) : (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    className="size-12 rounded-md border border-[hsl(var(--border))] bg-white object-contain p-1"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{s.name}</p>
                      <TierPill tier={s.tier} t={t} />
                      {!s.is_active && (
                        <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase">
                          {t('sponsor_inactive')}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {s.website_url ?? '—'} · order {s.display_order}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(s.id)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(s.id)}
                    disabled={isPending}
                    aria-label={t('sponsor_delete')}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TierPill({
  tier,
  t,
}: {
  tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
  t: ReturnType<typeof useTranslations<'admin'>>;
}) {
  const tone =
    tier === 'gold'
      ? 'border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-300'
      : tier === 'silver'
        ? 'border-slate-400/60 bg-slate-400/10 text-slate-700 dark:text-slate-300'
        : tier === 'bronze'
          ? 'border-orange-400/60 bg-orange-400/10 text-orange-700 dark:text-orange-300'
          : 'border-[hsl(var(--border))]';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${tone}`}>
      {t(`sponsors_tier_${tier}` as 'sponsors_tier_gold')}
    </span>
  );
}
