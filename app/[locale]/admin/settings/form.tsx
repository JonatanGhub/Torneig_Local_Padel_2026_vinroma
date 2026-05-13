'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateClubSettings } from './actions';

type Settings = {
  id: string;
  legal_name: string;
  cif: string | null;
  address: string | null;
  email: string;
  bizum_phone: string | null;
  iban: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setFeedback(null);
      const result = await updateClubSettings(formData);
      setFeedback(result.ok ? t('settings_saved') : `${t('settings_error')}: ${result.error}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={settings.id} />

      <Field name="legal_name" label={t('field_legal_name')} defaultValue={settings.legal_name} />
      <Field name="cif" label={t('field_cif')} defaultValue={settings.cif ?? ''} />
      <Field name="address" label={t('field_address')} defaultValue={settings.address ?? ''} />
      <Field name="email" label={t('field_email')} type="email" defaultValue={settings.email} />
      <Field
        name="bizum_phone"
        label={t('field_bizum_phone')}
        defaultValue={settings.bizum_phone ?? ''}
      />
      <Field name="iban" label={t('field_iban')} defaultValue={settings.iban ?? ''} />
      <Field
        name="contact_person_name"
        label={t('field_contact_name')}
        defaultValue={settings.contact_person_name ?? ''}
      />
      <Field
        name="contact_person_phone"
        label={t('field_contact_phone')}
        defaultValue={settings.contact_person_phone ?? ''}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '…' : t('settings_save')}
        </Button>
        {feedback && <span className="text-muted-foreground text-xs">{feedback}</span>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input name={name} type={type} defaultValue={defaultValue} />
    </label>
  );
}
