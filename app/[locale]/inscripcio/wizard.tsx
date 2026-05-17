'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isMinor, RegistrationSchema, type RegistrationInput } from '@/types/registration';
import { submitRegistration } from './actions';

type Category = {
  id: string;
  level: number;
  label: string;
  maxPairs: number;
  usedPairs: number;
};

type Step = 'player_a' | 'player_b' | 'category' | 'review';

const emptyPlayer = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: '',
  declared_level: 2,
  health_declaration_signed: false as boolean,
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const emptyGuardian = {
  legal_guardian_name: '',
  legal_guardian_dni: '',
  legal_guardian_phone: '',
  legal_guardian_email: '',
};

type Draft = {
  player_a: typeof emptyPlayer;
  player_b: typeof emptyPlayer;
  captain: 'a' | 'b';
  category_level: number;
  fee_mode: 'per_pair' | 'per_player';
  guardian_a?: typeof emptyGuardian;
  guardian_b?: typeof emptyGuardian;
  consent_data_processing: boolean;
  consent_results_publication: boolean;
  consent_whatsapp: boolean;
  consent_eligibility: boolean;
};

export function RegistrationWizard({
  tournamentId,
  categories,
  locale,
}: {
  tournamentId: string;
  categories: Category[];
  locale: 'ca' | 'es';
}) {
  const t = useTranslations();
  const [step, setStep] = useState<Step>('player_a');
  const [draft, setDraft] = useState<Draft>({
    player_a: { ...emptyPlayer },
    player_b: { ...emptyPlayer },
    captain: 'a',
    category_level: 2,
    fee_mode: 'per_pair',
    consent_data_processing: false,
    consent_results_publication: false,
    consent_whatsapp: false,
    consent_eligibility: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updatePlayer(side: 'a' | 'b', patch: Partial<typeof emptyPlayer>) {
    setDraft((prev) => ({ ...prev, [`player_${side}`]: { ...prev[`player_${side}`], ...patch } }));
  }

  function nextFromPlayerA() {
    setError(null);
    if (isMinor(draft.player_a.birth_date) && !draft.guardian_a) {
      setDraft((prev) => ({ ...prev, guardian_a: { ...emptyGuardian } }));
    }
    setStep('player_b');
  }

  function nextFromPlayerB() {
    setError(null);
    if (isMinor(draft.player_b.birth_date) && !draft.guardian_b) {
      setDraft((prev) => ({ ...prev, guardian_b: { ...emptyGuardian } }));
    }
    setStep('category');
  }

  function submit() {
    setError(null);
    const input: RegistrationInput = {
      player_a: {
        ...draft.player_a,
        health_declaration_signed: draft.player_a.health_declaration_signed as true,
      },
      player_b: {
        ...draft.player_b,
        health_declaration_signed: draft.player_b.health_declaration_signed as true,
      },
      captain: draft.captain,
      category_level: draft.category_level,
      fee_mode: draft.fee_mode,
      guardian_a: draft.guardian_a,
      guardian_b: draft.guardian_b,
      consent_data_processing: draft.consent_data_processing as true,
      consent_results_publication: draft.consent_results_publication,
      consent_whatsapp: draft.consent_whatsapp,
      consent_eligibility: draft.consent_eligibility as true,
    };

    const parsed = RegistrationSchema.safeParse(input);
    if (!parsed.success) {
      setError(t('registration.error_validation'));
      return;
    }

    const categoryId = categories.find((c) => c.level === draft.category_level)?.id;
    if (!categoryId) {
      setError(t('registration.error_unknown_category'));
      return;
    }

    startTransition(async () => {
      const result = await submitRegistration(parsed.data, {
        tournamentId,
        locale,
        categoryId,
      });
      if (!result.ok) {
        setError(
          t(`registration.error_${result.error}` as Parameters<typeof t>[0]) ?? result.error,
        );
        return;
      }
      setSuccess(result.primary_payment_reference);
      window.location.href = `/${locale}/p/${result.primary_payment_reference}`;
    });
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {step === 'player_a' && (
        <PlayerForm
          title={t('registration.player_a_title')}
          player={draft.player_a}
          onChange={(patch) => updatePlayer('a', patch)}
          guardian={draft.guardian_a}
          onGuardianChange={(patch) =>
            setDraft((prev) => ({
              ...prev,
              guardian_a: { ...(prev.guardian_a ?? emptyGuardian), ...patch },
            }))
          }
          onNext={nextFromPlayerA}
        />
      )}

      {step === 'player_b' && (
        <PlayerForm
          title={t('registration.player_b_title')}
          player={draft.player_b}
          onChange={(patch) => updatePlayer('b', patch)}
          guardian={draft.guardian_b}
          onGuardianChange={(patch) =>
            setDraft((prev) => ({
              ...prev,
              guardian_b: { ...(prev.guardian_b ?? emptyGuardian), ...patch },
            }))
          }
          onBack={() => setStep('player_a')}
          onNext={nextFromPlayerB}
        />
      )}

      {step === 'category' && (
        <CategoryStep
          categories={categories}
          value={draft.category_level}
          feeMode={draft.fee_mode}
          captain={draft.captain}
          onChangeLevel={(level) => setDraft((p) => ({ ...p, category_level: level }))}
          onChangeFeeMode={(m) => setDraft((p) => ({ ...p, fee_mode: m }))}
          onChangeCaptain={(c) => setDraft((p) => ({ ...p, captain: c }))}
          onBack={() => setStep('player_b')}
          onNext={() => setStep('review')}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          draft={draft}
          categoryLabel={
            categories.find((c) => c.level === draft.category_level)?.label ??
            String(draft.category_level)
          }
          onChangeConsent={(key, value) => setDraft((p) => ({ ...p, [key]: value }))}
          onBack={() => setStep('category')}
          onSubmit={submit}
          isPending={isPending}
        />
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-sm">Inscripció enviada. Redirigint al pagament…</p>}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Step[] = ['player_a', 'player_b', 'category', 'review'];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const isCurrent = s === current;
        const isPast = steps.indexOf(current) > i;
        return (
          <li
            key={s}
            className={cn(
              'flex items-center gap-2',
              isCurrent && 'text-foreground font-medium',
              !isCurrent && !isPast && 'text-muted-foreground',
              isPast && 'text-foreground',
            )}
          >
            <span
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-full text-xs',
                isCurrent && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                !isCurrent && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
              )}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 && <span>·</span>}
          </li>
        );
      })}
    </ol>
  );
}

function PlayerForm({
  title,
  player,
  onChange,
  guardian,
  onGuardianChange,
  onBack,
  onNext,
}: {
  title: string;
  player: typeof emptyPlayer;
  onChange: (patch: Partial<typeof emptyPlayer>) => void;
  guardian?: typeof emptyGuardian;
  onGuardianChange: (patch: Partial<typeof emptyGuardian>) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('registration');
  const showGuardian = player.birth_date && isMinor(player.birth_date);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledInput
          label={t('field_first_name')}
          value={player.first_name}
          onChange={(v) => onChange({ first_name: v })}
        />
        <LabeledInput
          label={t('field_last_name')}
          value={player.last_name}
          onChange={(v) => onChange({ last_name: v })}
        />
        <LabeledInput
          label={t('field_email')}
          value={player.email}
          type="email"
          onChange={(v) => onChange({ email: v })}
        />
        <LabeledInput
          label={t('field_phone')}
          value={player.phone}
          type="tel"
          onChange={(v) => onChange({ phone: v })}
        />
        <LabeledInput
          label={t('field_birth_date')}
          value={player.birth_date}
          type="date"
          onChange={(v) => onChange({ birth_date: v })}
        />
        <LabeledSelect
          label={t('field_declared_level')}
          value={String(player.declared_level)}
          onChange={(v) => onChange({ declared_level: Number(v) })}
          options={[
            { value: '1', label: t('level_1') },
            { value: '2', label: t('level_2') },
            { value: '3', label: t('level_3') },
            { value: '4', label: t('level_4') },
          ]}
        />
      </div>

      {showGuardian && guardian && (
        <div className="border-border space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-medium">{t('guardian_title')}</h3>
          <p className="text-muted-foreground text-xs">{t('guardian_subtitle')}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LabeledInput
              label={t('guardian_name')}
              value={guardian.legal_guardian_name}
              onChange={(v) => onGuardianChange({ legal_guardian_name: v })}
            />
            <LabeledInput
              label={t('guardian_dni')}
              value={guardian.legal_guardian_dni}
              onChange={(v) => onGuardianChange({ legal_guardian_dni: v })}
            />
            <LabeledInput
              label={t('guardian_phone')}
              value={guardian.legal_guardian_phone}
              type="tel"
              onChange={(v) => onGuardianChange({ legal_guardian_phone: v })}
            />
            <LabeledInput
              label={t('guardian_email')}
              value={guardian.legal_guardian_email}
              type="email"
              onChange={(v) => onGuardianChange({ legal_guardian_email: v })}
            />
          </div>
        </div>
      )}

      <div className="border-border space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-medium">{t('emergency_title')}</h3>
        <p className="text-muted-foreground text-xs">{t('emergency_subtitle')}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledInput
            label={t('emergency_name')}
            value={player.emergency_contact_name}
            onChange={(v) => onChange({ emergency_contact_name: v })}
          />
          <LabeledInput
            label={t('emergency_phone')}
            value={player.emergency_contact_phone}
            type="tel"
            onChange={(v) => onChange({ emergency_contact_phone: v })}
          />
        </div>
      </div>

      <div className="border-border space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-medium">{t('health_title')}</h3>
        <p className="text-muted-foreground text-xs">{t('health_text')}</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={player.health_declaration_signed}
            onChange={(e) => onChange({ health_declaration_signed: e.target.checked })}
          />
          <span>{t('health_checkbox')}</span>
        </label>
      </div>

      <div className="flex justify-between pt-2">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} type="button">
            ← {t('back')}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onNext} type="button">
          {t('next')} →
        </Button>
      </div>
    </section>
  );
}

function CategoryStep({
  categories,
  value,
  feeMode,
  captain,
  onChangeLevel,
  onChangeFeeMode,
  onChangeCaptain,
  onBack,
  onNext,
}: {
  categories: Category[];
  value: number;
  feeMode: 'per_pair' | 'per_player';
  captain: 'a' | 'b';
  onChangeLevel: (level: number) => void;
  onChangeFeeMode: (m: 'per_pair' | 'per_player') => void;
  onChangeCaptain: (c: 'a' | 'b') => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('registration');

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{t('category_title')}</h2>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('category_label')}</span>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {categories.map((c) => {
            const isFull = c.usedPairs >= c.maxPairs;
            const isSelected = c.level === value;
            return (
              <button
                key={c.id}
                type="button"
                disabled={isFull}
                onClick={() => onChangeLevel(c.level)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors',
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]',
                  isFull && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <span className="font-medium">{c.label}</span>
                <span
                  className={cn(
                    'text-xs',
                    isFull ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                  )}
                >
                  {isFull
                    ? t('category_full_label')
                    : t('category_capacity_label', { used: c.usedPairs, max: c.maxPairs })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('captain_label')}</span>
        <div className="flex gap-2">
          {(['a', 'b'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeCaptain(c)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                captain === c
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]'
                  : 'border-[hsl(var(--border))]',
              )}
            >
              {c === 'a' ? t('captain_a') : t('captain_b')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('fee_mode_label')}</span>
        <div className="space-y-2">
          <FeeModeOption
            value="per_pair"
            current={feeMode}
            title={t('fee_per_pair_title')}
            subtitle={t('fee_per_pair_subtitle')}
            recommended
            onSelect={() => onChangeFeeMode('per_pair')}
          />
          <FeeModeOption
            value="per_player"
            current={feeMode}
            title={t('fee_per_player_title')}
            subtitle={t('fee_per_player_subtitle')}
            onSelect={() => onChangeFeeMode('per_player')}
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} type="button">
          ← {t('back')}
        </Button>
        <Button onClick={onNext} type="button">
          {t('next')} →
        </Button>
      </div>
    </section>
  );
}

function FeeModeOption({
  value,
  current,
  title,
  subtitle,
  recommended,
  onSelect,
}: {
  value: 'per_pair' | 'per_player';
  current: 'per_pair' | 'per_player';
  title: string;
  subtitle: string;
  recommended?: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('registration');
  const isSelected = current === value;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'block w-full rounded-md border p-3 text-left transition-colors',
        isSelected
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]'
          : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]',
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        {recommended && (
          <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs">
            {t('recommended')}
          </span>
        )}
      </div>
    </button>
  );
}

function ReviewStep({
  draft,
  categoryLabel,
  onChangeConsent,
  onBack,
  onSubmit,
  isPending,
}: {
  draft: Draft;
  categoryLabel: string;
  onChangeConsent: (
    key:
      | 'consent_data_processing'
      | 'consent_results_publication'
      | 'consent_whatsapp'
      | 'consent_eligibility',
    value: boolean,
  ) => void;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const t = useTranslations('registration');

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{t('review_title')}</h2>

      <div className="space-y-2 text-sm">
        <p>
          <strong>{t('player_a_short')}:</strong> {draft.player_a.first_name}{' '}
          {draft.player_a.last_name} — {draft.player_a.email}
        </p>
        <p>
          <strong>{t('player_b_short')}:</strong> {draft.player_b.first_name}{' '}
          {draft.player_b.last_name} — {draft.player_b.email}
        </p>
        <p>
          <strong>{t('category_short')}:</strong> {categoryLabel}
        </p>
        <p>
          <strong>{t('fee_mode_short')}:</strong>{' '}
          {draft.fee_mode === 'per_pair' ? t('fee_per_pair_short') : t('fee_per_player_short')}
        </p>
        <p>
          <strong>{t('captain_short')}:</strong>{' '}
          {draft.captain === 'a' ? draft.player_a.first_name : draft.player_b.first_name}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <Checkbox
          checked={draft.consent_eligibility}
          onChange={(v) => onChangeConsent('consent_eligibility', v)}
          label={t('consent_eligibility')}
        />
        <Checkbox
          checked={draft.consent_data_processing}
          onChange={(v) => onChangeConsent('consent_data_processing', v)}
          label={t('consent_data_processing')}
        />
        <Checkbox
          checked={draft.consent_results_publication}
          onChange={(v) => onChangeConsent('consent_results_publication', v)}
          label={t('consent_results_publication')}
        />
        <Checkbox
          checked={draft.consent_whatsapp}
          onChange={(v) => onChangeConsent('consent_whatsapp', v)}
          label={t('consent_whatsapp')}
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} type="button" disabled={isPending}>
          ← {t('back')}
        </Button>
        <Button onClick={onSubmit} type="button" disabled={isPending}>
          {isPending ? '…' : t('submit')}
        </Button>
      </div>
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}
