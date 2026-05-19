'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createFee, updateFee, deleteFee } from './actions';

export type Fee = {
  id: string;
  label_ca: string;
  label_es: string;
  starts_at: string;
  ends_at: string;
  amount_per_player_cents: number;
  is_default_open: boolean;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FeesForm({ tournamentId, fees }: { tournamentId: string; fees: Fee[] }) {
  const t = useTranslations('admin');

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">{t('fees_title')}</h2>
        <p className="text-muted-foreground text-sm">{t('fees_subtitle')}</p>
      </header>

      <div className="space-y-4">
        {fees.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('fees_empty')}</p>
        ) : (
          fees.map((fee) => <FeeRow key={fee.id} fee={fee} tournamentId={tournamentId} />)
        )}
      </div>

      <div className="border-border border-t pt-6">
        <h3 className="mb-3 text-sm font-semibold">{t('fees_add_title')}</h3>
        <NewFeeForm tournamentId={tournamentId} />
      </div>
    </section>
  );
}

function FeeRow({ fee, tournamentId }: { fee: Fee; tournamentId: string }) {
  const t = useTranslations('admin');
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFeedback(null);
    setIsError(false);
    startSave(async () => {
      const result = await updateFee(formData);
      if (result.ok) {
        setFeedback(t('fees_saved'));
      } else {
        setIsError(true);
        setFeedback(`${t('fees_error')}: ${result.error}`);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t('fees_confirm_delete'))) return;
    const formData = new FormData();
    formData.set('id', fee.id);
    setFeedback(null);
    setIsError(false);
    startDelete(async () => {
      const result = await deleteFee(formData);
      if (!result.ok) {
        setIsError(true);
        setFeedback(`${t('fees_error')}: ${result.error}`);
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="border-border space-y-3 rounded-md border p-4">
      <input type="hidden" name="id" value={fee.id} />
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledInput name="label_ca" label={t('fees_label_ca')} defaultValue={fee.label_ca} />
        <LabeledInput name="label_es" label={t('fees_label_es')} defaultValue={fee.label_es} />
        <LabeledInput
          name="starts_at"
          label={t('fees_starts_at')}
          type="datetime-local"
          defaultValue={toLocalInputValue(fee.starts_at)}
        />
        <LabeledInput
          name="ends_at"
          label={t('fees_ends_at')}
          type="datetime-local"
          defaultValue={toLocalInputValue(fee.ends_at)}
        />
        <LabeledInput
          name="amount_eur"
          label={t('fees_amount_eur')}
          type="number"
          step="0.01"
          min="0"
          defaultValue={(fee.amount_per_player_cents / 100).toFixed(2)}
        />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="is_default_open"
            defaultChecked={fee.is_default_open}
            className="border-input size-4 rounded border"
          />
          <span>{t('fees_is_default_open')}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={isSaving || isDeleting}>
          {isSaving ? '…' : t('fees_save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
          className="text-destructive"
        >
          <Trash2 className="size-3.5" />
          {isDeleting ? '…' : t('fees_delete')}
        </Button>
        {feedback && (
          <span className={`text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {feedback}
          </span>
        )}
      </div>
    </form>
  );
}

function NewFeeForm({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFeedback(null);
    setIsError(false);
    startTransition(async () => {
      const result = await createFee(formData);
      if (result.ok) {
        setFeedback(t('fees_created'));
        setResetKey((k) => k + 1);
      } else {
        setIsError(true);
        setFeedback(`${t('fees_error')}: ${result.error}`);
      }
    });
  }

  return (
    <form key={resetKey} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledInput name="label_ca" label={t('fees_label_ca')} required />
        <LabeledInput name="label_es" label={t('fees_label_es')} required />
        <LabeledInput name="starts_at" label={t('fees_starts_at')} type="datetime-local" required />
        <LabeledInput name="ends_at" label={t('fees_ends_at')} type="datetime-local" required />
        <LabeledInput
          name="amount_eur"
          label={t('fees_amount_eur')}
          type="number"
          step="0.01"
          min="0"
          required
        />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="is_default_open"
            className="border-input size-4 rounded border"
          />
          <span>{t('fees_is_default_open')}</span>
        </label>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '…' : t('fees_create')}
        </Button>
        {feedback && (
          <span className={`text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {feedback}
          </span>
        )}
      </div>
    </form>
  );
}

function LabeledInput({
  name,
  label,
  defaultValue,
  type = 'text',
  step,
  min,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        step={step}
        min={min}
        required={required}
      />
    </label>
  );
}
