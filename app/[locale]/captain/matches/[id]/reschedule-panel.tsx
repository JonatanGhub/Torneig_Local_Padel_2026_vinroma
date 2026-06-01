'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, X, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cancelReschedule, proposeReschedule, respondToReschedule } from './actions';

type Proposal = {
  id: string;
  proposer_pair_side: 'a' | 'b';
  new_scheduled_at: string;
  new_court_label: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
};

export function ReschedulePanel({
  locale,
  matchId,
  mySide,
  pending,
  history,
}: {
  locale: string;
  matchId: string;
  mySide: 'a' | 'b';
  pending: Proposal | null;
  history: Proposal[];
}) {
  const t = useTranslations('captain');
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    });

  function submitPropose(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await proposeReschedule(formData);
      if (!res.ok) setError(t(`reschedule_error_${res.error}` as 'reschedule_error_invalid_input'));
      else setShowForm(false);
    });
  }

  function submitRespond(proposalId: string, accept: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set('proposalId', proposalId);
    fd.set('accept', accept ? 'yes' : 'no');
    startTransition(async () => {
      const res = await respondToReschedule(fd);
      if (!res.ok) setError(t(`reschedule_error_${res.error}` as 'reschedule_error_invalid_input'));
    });
  }

  function submitCancel(proposalId: string) {
    setError(null);
    const fd = new FormData();
    fd.set('proposalId', proposalId);
    startTransition(async () => {
      const res = await cancelReschedule(fd);
      if (!res.ok) setError(t(`reschedule_error_${res.error}` as 'reschedule_error_invalid_input'));
    });
  }

  const defaultDate = (() => {
    const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <section className="border-border mt-8 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <CalendarClock className="size-4" />
          {t('reschedule_title')}
        </h2>
        {!pending && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-crimson-600 hover:text-crimson-500 dark:text-crimson-400 text-xs"
          >
            + {t('reschedule_propose_cta')}
          </button>
        )}
      </div>

      {pending && pending.proposer_pair_side === mySide && (
        <div className="bg-secondary mb-3 rounded-md p-3 text-sm">
          <p className="font-medium">{t('reschedule_pending_mine_title')}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('reschedule_pending_new')}: <strong>{formatDate(pending.new_scheduled_at)}</strong>
            {pending.new_court_label ? ` · ${pending.new_court_label}` : ''}
          </p>
          {pending.message && (
            <p className="text-muted-foreground mt-1 text-xs italic">“{pending.message}”</p>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => submitCancel(pending.id)}
            className="text-muted-foreground hover:text-destructive mt-2 inline-flex items-center gap-1 text-xs"
          >
            <X className="size-3" />
            {t('reschedule_cancel_mine')}
          </button>
        </div>
      )}

      {pending && pending.proposer_pair_side !== mySide && (
        <div className="bg-destructive/5 border-destructive/30 mb-3 rounded-md border p-3 text-sm">
          <p className="font-medium">{t('reschedule_pending_rival_title')}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('reschedule_pending_new')}: <strong>{formatDate(pending.new_scheduled_at)}</strong>
            {pending.new_court_label ? ` · ${pending.new_court_label}` : ''}
          </p>
          {pending.message && (
            <p className="text-muted-foreground mt-1 text-xs italic">“{pending.message}”</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => submitRespond(pending.id, true)}
              className="bg-green-600 hover:bg-green-500"
              size="sm"
            >
              <Check className="mr-1 size-4" />
              {t('reschedule_accept')}
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => submitRespond(pending.id, false)}
              variant="outline"
              size="sm"
            >
              <X className="mr-1 size-4" />
              {t('reschedule_reject')}
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          action={submitPropose}
          className="bg-card mb-3 space-y-3 rounded-md border border-[hsl(var(--border))] p-3"
        >
          <input type="hidden" name="matchId" value={matchId} />
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">{t('reschedule_new_when')}</label>
            <Input
              type="datetime-local"
              name="newScheduledAt"
              required
              defaultValue={defaultDate}
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">{t('reschedule_new_court')}</label>
            <Input type="text" name="newCourtLabel" placeholder="Pista 1" />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">{t('reschedule_message')}</label>
            <Input
              type="text"
              name="message"
              placeholder={t('reschedule_message_placeholder')}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              disabled={isPending}
            >
              {t('reschedule_cancel_form')}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              <Send className="mr-1 size-4" />
              {t('reschedule_send')}
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      {history.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="text-muted-foreground cursor-pointer">
            {t('reschedule_history')} ({history.length})
          </summary>
          <ul className="divide-border mt-2 divide-y rounded-md border border-[hsl(var(--border))]">
            {history.map((p) => (
              <li key={p.id} className="px-3 py-2">
                <p className="text-muted-foreground text-[11px]">
                  {formatDate(p.created_at)} · {t(`reschedule_status_${p.status}`)}
                </p>
                <p>
                  →{' '}
                  <span className="font-mono">
                    {formatDate(p.new_scheduled_at)}
                    {p.new_court_label ? ` · ${p.new_court_label}` : ''}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
