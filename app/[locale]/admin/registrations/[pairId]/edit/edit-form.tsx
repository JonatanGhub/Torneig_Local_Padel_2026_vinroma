'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { editPairRegistration } from '../../edit-actions';

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
type TshirtSize = (typeof TSHIRT_SIZES)[number];

export type PlayerInitial = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  tshirt_size: TshirtSize | '';
  emergency_contact_name: string;
  emergency_contact_phone: string;
  consent_whatsapp: boolean;
};

export function EditRegistrationForm({
  pairId,
  categoryId: initialCategoryId,
  captainSide: initialCaptainSide,
  locale,
  categories,
  categoryLocked,
  categoryLockedReason,
  playerA: initialA,
  playerB: initialB,
}: {
  pairId: string;
  categoryId: string;
  captainSide: 'a' | 'b';
  locale: 'ca' | 'es';
  categories: { id: string; label: string }[];
  categoryLocked: boolean;
  categoryLockedReason: 'draw' | 'matches' | null;
  playerA: PlayerInitial;
  playerB: PlayerInitial;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [playerA, setPlayerA] = useState<PlayerInitial>(initialA);
  const [playerB, setPlayerB] = useState<PlayerInitial>(initialB);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [captainSide, setCaptainSide] = useState<'a' | 'b'>(initialCaptainSide);

  function submit() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const res = await editPairRegistration({
        pairId,
        categoryId,
        captainSide,
        locale,
        playerA,
        playerB,
      });
      if (!res.ok) {
        if (res.error === 'category_locked_by_draw')
          setError(t('registrations_edit_err_locked_draw'));
        else if (res.error === 'category_locked_by_matches')
          setError(t('registrations_edit_err_locked_matches'));
        else if (res.error === 'duplicate_email')
          setError(t('registrations_edit_err_duplicate_email'));
        else if (res.error === 'invalid_input') setError(t('registrations_edit_err_invalid'));
        else if (res.error === 'forbidden') setError(t('registrations_edit_err_forbidden'));
        else setError(res.error);
        return;
      }
      setFeedback(t('registrations_edit_saved'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {categoryLocked && categoryLockedReason && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <p>
            {categoryLockedReason === 'draw'
              ? t('registrations_edit_locked_draw_hint')
              : t('registrations_edit_locked_matches_hint')}
          </p>
        </div>
      )}

      <PlayerCard
        title={t('registrations_player_a')}
        player={playerA}
        onChange={setPlayerA}
        t={t}
      />
      <PlayerCard
        title={t('registrations_player_b')}
        player={playerB}
        onChange={setPlayerB}
        t={t}
      />

      <div className="border-border space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{t('registrations_edit_pair_section')}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">{t('registrations_field_category')}</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={categoryLocked}
              className="border-input bg-background flex h-10 w-full rounded-md border px-2 text-sm disabled:opacity-60"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">{t('registrations_field_captain')}</span>
            <div className="flex h-10 items-center gap-3">
              <label className="inline-flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={captainSide === 'a'}
                  onChange={() => setCaptainSide('a')}
                />
                A
              </label>
              <label className="inline-flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={captainSide === 'b'}
                  onChange={() => setCaptainSide('b')}
                />
                B
              </label>
            </div>
          </label>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {feedback && <p className="text-sm text-green-600">{feedback}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/admin/registrations`)}
          disabled={isPending}
        >
          {t('registrations_edit_cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={isPending}>
          <Save className="mr-1.5 size-3.5" />
          {isPending ? '…' : t('registrations_edit_save')}
        </Button>
      </div>
    </div>
  );
}

function PlayerCard({
  title,
  player,
  onChange,
  t,
}: {
  title: string;
  player: PlayerInitial;
  onChange: (next: PlayerInitial) => void;
  t: (k: string) => string;
}) {
  return (
    <fieldset className="border-border space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledInput
          label={t('registrations_field_first_name')}
          value={player.first_name}
          onChange={(v) => onChange({ ...player, first_name: v })}
        />
        <LabeledInput
          label={t('registrations_field_last_name')}
          value={player.last_name}
          onChange={(v) => onChange({ ...player, last_name: v })}
        />
        <LabeledInput
          label={t('registrations_field_email')}
          value={player.email}
          type="email"
          onChange={(v) => onChange({ ...player, email: v })}
        />
        <LabeledInput
          label={t('registrations_field_phone')}
          value={player.phone}
          type="tel"
          onChange={(v) => onChange({ ...player, phone: v })}
        />
        <LabeledInput
          label={t('registrations_field_birth_date')}
          value={player.birth_date}
          type="date"
          onChange={(v) => onChange({ ...player, birth_date: v })}
        />
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('registrations_field_tshirt_size')}</span>
          <select
            value={player.tshirt_size}
            onChange={(e) =>
              onChange({ ...player, tshirt_size: e.target.value as TshirtSize | '' })
            }
            className="border-input bg-background flex h-10 w-full rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {TSHIRT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <LabeledInput
          label={t('registrations_field_emergency_name')}
          value={player.emergency_contact_name}
          onChange={(v) => onChange({ ...player, emergency_contact_name: v })}
        />
        <LabeledInput
          label={t('registrations_field_emergency_phone')}
          value={player.emergency_contact_phone}
          type="tel"
          onChange={(v) => onChange({ ...player, emergency_contact_phone: v })}
        />
      </div>
      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={player.consent_whatsapp}
          onChange={(e) => onChange({ ...player, consent_whatsapp: e.target.checked })}
        />
        <span>{t('registrations_field_consent_whatsapp')}</span>
      </label>
    </fieldset>
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
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
