'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertSponsor } from './actions';

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

export function SponsorForm({
  sponsor,
  onDone,
}: {
  sponsor?: Sponsor | null;
  onDone?: () => void;
}) {
  const t = useTranslations('admin');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await upsertSponsor(formData);
      if (!res.ok) setError(res.error);
      else onDone?.();
    });
  }

  return (
    <form action={submit} className="bg-card space-y-3 rounded-md border p-4 text-sm">
      {sponsor?.id && <input type="hidden" name="id" value={sponsor.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('sponsor_name')}</span>
          <Input
            type="text"
            name="name"
            required
            maxLength={120}
            defaultValue={sponsor?.name ?? ''}
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('sponsor_tier')}</span>
          <select
            name="tier"
            defaultValue={sponsor?.tier ?? 'collaborator'}
            required
            className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-sm"
          >
            <option value="gold">{t('sponsors_tier_gold')}</option>
            <option value="silver">{t('sponsors_tier_silver')}</option>
            <option value="bronze">{t('sponsors_tier_bronze')}</option>
            <option value="collaborator">{t('sponsors_tier_collaborator')}</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">{t('sponsor_logo_url')}</span>
        <Input
          type="url"
          name="logoUrl"
          required
          maxLength={2000}
          defaultValue={sponsor?.logo_url ?? ''}
          placeholder="https://…/logo.png"
        />
        <span className="text-muted-foreground text-[10px]">{t('sponsor_logo_help')}</span>
      </label>

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">{t('sponsor_website_url')}</span>
        <Input
          type="url"
          name="websiteUrl"
          maxLength={2000}
          defaultValue={sponsor?.website_url ?? ''}
          placeholder="https://…"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('sponsor_role_ca')}</span>
          <Input
            type="text"
            name="roleCa"
            maxLength={120}
            defaultValue={sponsor?.role_ca ?? ''}
            placeholder={t('sponsor_role_placeholder')}
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('sponsor_role_es')}</span>
          <Input
            type="text"
            name="roleEs"
            maxLength={120}
            defaultValue={sponsor?.role_es ?? ''}
            placeholder={t('sponsor_role_placeholder')}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('sponsor_display_order')}</span>
          <Input
            type="number"
            name="displayOrder"
            min={0}
            max={9999}
            defaultValue={sponsor?.display_order ?? 0}
          />
        </label>
        <label className="flex items-end gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={sponsor?.is_active ?? true}
            className="size-4"
          />
          <span className="text-xs">{t('sponsor_active')}</span>
        </label>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isPending}>
            {t('walkover_cancel')}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '…' : sponsor?.id ? t('sponsor_save') : t('sponsor_create')}
        </Button>
      </div>
    </form>
  );
}
