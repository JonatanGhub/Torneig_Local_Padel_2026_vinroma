'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, AlertTriangle } from 'lucide-react';
import { captainWithdrawPair } from './withdraw-actions';

export type CaptainPairItem = {
  id: string;
  status: 'draft' | 'pending_payment' | 'confirmed' | 'withdrawn' | 'disqualified';
  categoryLabel: string;
  partnerLabel: string;
  withdrawnReason: string | null;
  hasMatches: boolean;
};

export function MyPairsCard({ pairs, locale }: { pairs: CaptainPairItem[]; locale: 'ca' | 'es' }) {
  const t = useTranslations('captain');

  if (pairs.length === 0) return null;

  return (
    <section className="glass-card mb-6 rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-crimson-500/15 text-crimson-300 inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Users className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-white">{t('mypairs_title')}</p>
          <p className="text-xs text-white/55">{t('mypairs_body')}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {pairs.map((p) => (
          <PairRow key={p.id} pair={p} locale={locale} />
        ))}
      </ul>
    </section>
  );
}

function PairRow({ pair, locale }: { pair: CaptainPairItem; locale: 'ca' | 'es' }) {
  const t = useTranslations('captain');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isWithdrawn = pair.status === 'withdrawn' || pair.status === 'disqualified';
  const canWithdraw =
    !isWithdrawn &&
    !pair.hasMatches &&
    (pair.status === 'pending_payment' || pair.status === 'confirmed');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await captainWithdrawPair({
        pairId: pair.id,
        reason: reason || undefined,
        locale,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {pair.categoryLabel} <span className="text-white/55">·</span>{' '}
            <span className="text-white/75">{pair.partnerLabel}</span>
          </p>
          {isWithdrawn && pair.withdrawnReason && (
            <p className="mt-1 text-xs text-orange-300">
              {t('mypairs_withdrawn_reason')}: {pair.withdrawnReason}
            </p>
          )}
          {!isWithdrawn && pair.hasMatches && (
            <p className="mt-1 flex items-center gap-1 text-xs text-white/55">
              <AlertTriangle className="size-3" />
              {t('mypairs_cannot_withdraw_hint')}
            </p>
          )}
        </div>
        <StatusPill status={pair.status} t={t} />
      </div>

      {canWithdraw && (
        <div className="mt-3">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border border-orange-400/40 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-400/10"
            >
              {t('mypairs_withdraw_cta')}
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-orange-400/30 bg-orange-500/5 p-3">
              <p className="text-sm font-medium text-white">{t('mypairs_withdraw_confirm')}</p>
              <label className="block">
                <span className="text-xs text-white/65">{t('mypairs_withdraw_reason_label')}</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t('mypairs_withdraw_reason_placeholder')}
                  className="bg-ink-900/70 mt-1 w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/90"
                />
              </label>
              {error && (
                <p className="text-xs text-red-300">
                  {t(`mypairs_withdraw_error_${error}` as 'mypairs_withdraw_error_pair_not_found')}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
                >
                  {t('mypairs_withdraw_cancel')}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  {isPending ? t('mypairs_withdraw_saving') : t('mypairs_withdraw_submit')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StatusPill({
  status,
  t,
}: {
  status: CaptainPairItem['status'];
  t: ReturnType<typeof useTranslations<'captain'>>;
}) {
  const tone =
    status === 'confirmed'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
      : status === 'pending_payment'
        ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
        : status === 'withdrawn'
          ? 'border-orange-400/40 bg-orange-400/10 text-orange-300'
          : status === 'disqualified'
            ? 'border-red-400/40 bg-red-400/10 text-red-300'
            : 'border-white/15 bg-white/5 text-white/65';

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase ${tone}`}
    >
      {t(`mypairs_status_${status}` as 'mypairs_status_confirmed')}
    </span>
  );
}
