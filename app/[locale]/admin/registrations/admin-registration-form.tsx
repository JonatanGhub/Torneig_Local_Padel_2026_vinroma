'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isMinor, type RegistrationInput } from '@/types/registration';
import { adminCreateRegistration } from './actions';

type Category = { id: string; level: number; label: string };

type PlayerDraft = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  declared_level: number;
  health_declaration_signed: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};

type GuardianDraft = {
  legal_guardian_name: string;
  legal_guardian_dni: string;
  legal_guardian_phone: string;
  legal_guardian_email: string;
};

const emptyPlayer: PlayerDraft = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: '',
  declared_level: 2,
  health_declaration_signed: false,
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const emptyGuardian: GuardianDraft = {
  legal_guardian_name: '',
  legal_guardian_dni: '',
  legal_guardian_phone: '',
  legal_guardian_email: '',
};

export function AdminRegistrationForm({
  tournamentId,
  locale,
  categories,
}: {
  tournamentId: string;
  locale: 'ca' | 'es';
  categories: Category[];
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [playerA, setPlayerA] = useState<PlayerDraft>(emptyPlayer);
  const [playerB, setPlayerB] = useState<PlayerDraft>(emptyPlayer);
  const [captain, setCaptain] = useState<'a' | 'b'>('a');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [feeMode, setFeeMode] = useState<'per_pair' | 'per_player'>('per_pair');
  const [guardianA, setGuardianA] = useState<GuardianDraft>(emptyGuardian);
  const [guardianB, setGuardianB] = useState<GuardianDraft>(emptyGuardian);
  const [initialStatus, setInitialStatus] = useState<'pending_payment' | 'confirmed'>(
    'pending_payment',
  );
  const [notes, setNotes] = useState('');
  const [sendCaptainEmail, setSendCaptainEmail] = useState(true);
  const canSendEmail = initialStatus === 'pending_payment';

  const aIsMinor = playerA.birth_date ? isMinor(playerA.birth_date) : false;
  const bIsMinor = playerB.birth_date ? isMinor(playerB.birth_date) : false;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!selectedCategory) {
      setError('invalid_options');
      return;
    }

    const input: RegistrationInput = {
      player_a: {
        ...playerA,
        health_declaration_signed: playerA.health_declaration_signed as true,
      },
      player_b: {
        ...playerB,
        health_declaration_signed: playerB.health_declaration_signed as true,
      },
      captain,
      category_level: selectedCategory.level,
      fee_mode: feeMode,
      ...(aIsMinor ? { guardian_a: guardianA } : {}),
      ...(bIsMinor ? { guardian_b: guardianB } : {}),
      consent_data_processing: true,
      consent_results_publication: true,
      consent_whatsapp: false,
      consent_eligibility: true,
    };

    startTransition(async () => {
      const res = await adminCreateRegistration(input, {
        tournamentId,
        categoryId,
        locale,
        initialStatus,
        adminNotes: notes || undefined,
        sendCaptainEmail: canSendEmail && sendCaptainEmail,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.field_errors) setFieldErrors(res.field_errors);
        return;
      }
      const params = new URLSearchParams({ status: initialStatus });
      if (res.email_sent) params.set('email', 'sent');
      else if (res.email_error) params.set('email', `error_${res.email_error}`);
      router.push(`/${locale}/admin/registrations?${params.toString()}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold">
          {t('registrations_player_a_title')}
        </legend>
        <PlayerFields
          value={playerA}
          onChange={setPlayerA}
          errorPrefix="player_a"
          fieldErrors={fieldErrors}
          t={t}
        />
        {aIsMinor && (
          <GuardianFields
            value={guardianA}
            onChange={setGuardianA}
            errorPrefix="guardian_a"
            fieldErrors={fieldErrors}
            t={t}
          />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold">
          {t('registrations_player_b_title')}
        </legend>
        <PlayerFields
          value={playerB}
          onChange={setPlayerB}
          errorPrefix="player_b"
          fieldErrors={fieldErrors}
          t={t}
        />
        {bIsMinor && (
          <GuardianFields
            value={guardianB}
            onChange={setGuardianB}
            errorPrefix="guardian_b"
            fieldErrors={fieldErrors}
            t={t}
          />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold">
          {t('registrations_pair_setup_title')}
        </legend>
        <Field label={t('registrations_field_category')}>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('registrations_field_captain')}>
          <div className="flex gap-2">
            <CaptainRadio value="a" active={captain} onChange={setCaptain}>
              {t('registrations_captain_a')}
            </CaptainRadio>
            <CaptainRadio value="b" active={captain} onChange={setCaptain}>
              {t('registrations_captain_b')}
            </CaptainRadio>
          </div>
        </Field>
        <Field label={t('registrations_field_fee_mode')}>
          <div className="flex gap-2">
            <FeeRadio value="per_pair" active={feeMode} onChange={setFeeMode}>
              {t('registrations_fee_per_pair')}
            </FeeRadio>
            <FeeRadio value="per_player" active={feeMode} onChange={setFeeMode}>
              {t('registrations_fee_per_player')}
            </FeeRadio>
          </div>
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold">
          {t('registrations_admin_section')}
        </legend>
        <Field label={t('registrations_field_initial_status')}>
          <select
            value={initialStatus}
            onChange={(e) => setInitialStatus(e.target.value as 'pending_payment' | 'confirmed')}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
          >
            <option value="pending_payment">{t('registrations_initial_status_pending')}</option>
            <option value="confirmed">{t('registrations_initial_status_confirmed')}</option>
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            {initialStatus === 'confirmed'
              ? t('registrations_initial_status_confirmed_help')
              : t('registrations_initial_status_pending_help')}
          </p>
        </Field>
        <Field label={t('registrations_field_admin_notes')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t('registrations_admin_notes_placeholder')}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
          />
        </Field>
        <div className="border-border space-y-2 rounded-md border border-dashed p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!canSendEmail}
              checked={canSendEmail && sendCaptainEmail}
              onChange={(e) => setSendCaptainEmail(e.target.checked)}
            />
            <span className={canSendEmail ? '' : 'text-muted-foreground'}>
              {t('registrations_field_send_captain_email')}
            </span>
          </label>
          <p className="text-muted-foreground text-xs">
            {canSendEmail
              ? t('registrations_send_captain_email_help')
              : t('registrations_send_captain_email_disabled_help')}
          </p>
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-300">
          {t(`registrations_error_${error}` as 'registrations_error_validation_failed')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('registrations_saving') : t('registrations_submit')}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs">{label}</span>
      {children}
    </label>
  );
}

function PlayerFields({
  value,
  onChange,
  errorPrefix,
  fieldErrors,
  t,
}: {
  value: PlayerDraft;
  onChange: (v: PlayerDraft) => void;
  errorPrefix: string;
  fieldErrors: Record<string, string>;
  t: ReturnType<typeof useTranslations<'admin'>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label={t('registrations_field_first_name')}>
        <Input
          value={value.first_name}
          onChange={(e) => onChange({ ...value, first_name: e.target.value })}
          required
        />
        {fieldErrors[`${errorPrefix}.first_name`] && (
          <FieldError msg={fieldErrors[`${errorPrefix}.first_name`]!} />
        )}
      </Field>
      <Field label={t('registrations_field_last_name')}>
        <Input
          value={value.last_name}
          onChange={(e) => onChange({ ...value, last_name: e.target.value })}
          required
        />
      </Field>
      <Field label={t('registrations_field_email')}>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          required
        />
        {fieldErrors[`${errorPrefix}.email`] && (
          <FieldError msg={fieldErrors[`${errorPrefix}.email`]!} />
        )}
      </Field>
      <Field label={t('registrations_field_phone')}>
        <Input
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          required
        />
      </Field>
      <Field label={t('registrations_field_birth_date')}>
        <Input
          type="date"
          value={value.birth_date}
          onChange={(e) => onChange({ ...value, birth_date: e.target.value })}
          required
        />
      </Field>
      <Field label={t('registrations_field_declared_level')}>
        <select
          value={value.declared_level}
          onChange={(e) => onChange({ ...value, declared_level: Number(e.target.value) })}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}ª
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('registrations_field_emergency_name')}>
        <Input
          value={value.emergency_contact_name}
          onChange={(e) => onChange({ ...value, emergency_contact_name: e.target.value })}
          required
        />
      </Field>
      <Field label={t('registrations_field_emergency_phone')}>
        <Input
          type="tel"
          value={value.emergency_contact_phone}
          onChange={(e) => onChange({ ...value, emergency_contact_phone: e.target.value })}
          required
        />
      </Field>
      <div className="md:col-span-2">
        <div className="border-border space-y-2 rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs">{t('registrations_health_text')}</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={value.health_declaration_signed}
              onChange={(e) => onChange({ ...value, health_declaration_signed: e.target.checked })}
            />
            <span>{t('registrations_health_checkbox')}</span>
          </label>
          {fieldErrors[`${errorPrefix}.health_declaration_signed`] && (
            <FieldError msg={fieldErrors[`${errorPrefix}.health_declaration_signed`]!} />
          )}
        </div>
      </div>
    </div>
  );
}

function GuardianFields({
  value,
  onChange,
  errorPrefix,
  fieldErrors,
  t,
}: {
  value: GuardianDraft;
  onChange: (v: GuardianDraft) => void;
  errorPrefix: string;
  fieldErrors: Record<string, string>;
  t: ReturnType<typeof useTranslations<'admin'>>;
}) {
  return (
    <div className="border-border space-y-3 rounded-md border border-dashed p-3">
      <p className="text-muted-foreground text-xs">{t('registrations_guardian_help')}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('registrations_field_guardian_name')}>
          <Input
            value={value.legal_guardian_name}
            onChange={(e) => onChange({ ...value, legal_guardian_name: e.target.value })}
            required
          />
        </Field>
        <Field label={t('registrations_field_guardian_dni')}>
          <Input
            value={value.legal_guardian_dni}
            onChange={(e) => onChange({ ...value, legal_guardian_dni: e.target.value })}
            required
          />
        </Field>
        <Field label={t('registrations_field_guardian_phone')}>
          <Input
            type="tel"
            value={value.legal_guardian_phone}
            onChange={(e) => onChange({ ...value, legal_guardian_phone: e.target.value })}
            required
          />
        </Field>
        <Field label={t('registrations_field_guardian_email')}>
          <Input
            type="email"
            value={value.legal_guardian_email}
            onChange={(e) => onChange({ ...value, legal_guardian_email: e.target.value })}
            required
          />
        </Field>
      </div>
      {fieldErrors[`${errorPrefix}.legal_guardian_email`] && (
        <FieldError msg={fieldErrors[`${errorPrefix}.legal_guardian_email`]!} />
      )}
    </div>
  );
}

function CaptainRadio({
  value,
  active,
  onChange,
  children,
}: {
  value: 'a' | 'b';
  active: 'a' | 'b';
  onChange: (v: 'a' | 'b') => void;
  children: React.ReactNode;
}) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-md border px-3 py-2 text-sm ${
        isActive
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
          : 'border-[hsl(var(--border))]'
      }`}
    >
      {children}
    </button>
  );
}

function FeeRadio({
  value,
  active,
  onChange,
  children,
}: {
  value: 'per_pair' | 'per_player';
  active: 'per_pair' | 'per_player';
  onChange: (v: 'per_pair' | 'per_player') => void;
  children: React.ReactNode;
}) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-md border px-3 py-2 text-sm ${
        isActive
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
          : 'border-[hsl(var(--border))]'
      }`}
    >
      {children}
    </button>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="mt-1 text-xs text-red-700 dark:text-red-300">{msg}</p>;
}
