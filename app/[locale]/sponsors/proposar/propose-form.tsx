'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { proposeSponsor } from './actions';

export function ProposeSponsorForm({ locale }: { locale: 'ca' | 'es' }) {
  const t = useTranslations('sponsors');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await proposeSponsor(fd);
      if (!res.ok) {
        setError(
          res.error === 'invalid_input' ? t('propose_error_invalid') : t('propose_error_generic'),
        );
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-12 text-emerald-400" />
        <h2 className="font-display text-2xl font-bold">{t('propose_thanks_title')}</h2>
        <p className="mt-2 text-sm text-white/65">{t('propose_thanks_body')}</p>
        <Link
          href={`/${locale}/sponsors`}
          className="mt-6 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
        >
          <ArrowLeft className="size-3" />
          {t('propose_back')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-crimson-400 text-xs font-semibold tracking-widest uppercase">
          {t('propose_form_section_sponsor')}
        </h3>
        <Field name="name" label={t('propose_field_name')} required />
        <Field
          name="logo_url"
          type="url"
          label={t('propose_field_logo_url')}
          hint={t('propose_field_logo_hint')}
          placeholder="https://…"
          required
        />
        <Field
          name="website_url"
          type="url"
          label={t('propose_field_website_url')}
          placeholder="https://…"
        />
        <label className="block space-y-1 text-sm">
          <span className="text-white/65">{t('propose_field_tier')}</span>
          <select
            name="tier"
            defaultValue="collaborator"
            className="bg-ink-900/70 mt-1 h-10 w-full rounded-md border border-white/15 px-3 text-sm text-white/90"
          >
            <option value="gold">{t('tier_gold')}</option>
            <option value="silver">{t('tier_silver')}</option>
            <option value="bronze">{t('tier_bronze')}</option>
            <option value="collaborator">{t('tier_collaborator')}</option>
          </select>
        </label>
        <Field name="role_ca" label={t('propose_field_role_ca')} />
        <Field name="role_es" label={t('propose_field_role_es')} />
      </section>

      <section className="space-y-4">
        <h3 className="text-crimson-400 text-xs font-semibold tracking-widest uppercase">
          {t('propose_form_section_contact')}
        </h3>
        <Field name="submitter_name" label={t('propose_field_submitter_name')} required />
        <Field
          name="submitter_email"
          type="email"
          label={t('propose_field_submitter_email')}
          required
        />
        <Field name="submitter_phone" type="tel" label={t('propose_field_submitter_phone')} />
        <label className="block space-y-1 text-sm">
          <span className="text-white/65">{t('propose_field_message')}</span>
          <textarea
            name="message"
            rows={3}
            maxLength={1000}
            className="bg-ink-900/70 mt-1 w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/90"
          />
        </label>
      </section>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {isPending ? t('propose_submitting') : t('propose_submit')}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  placeholder,
  required,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-white/65">
        {label}
        {required && <span className="text-crimson-400"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="bg-ink-900/70 mt-1 h-10 w-full rounded-md border border-white/15 px-3 text-sm text-white/90"
      />
      {hint && <span className="block text-xs text-white/45">{hint}</span>}
    </label>
  );
}
