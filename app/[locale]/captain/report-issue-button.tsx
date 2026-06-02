'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bug, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { reportIssue } from './report-issue-actions';

export function ReportIssueButton({ locale }: { locale: 'ca' | 'es' }) {
  const t = useTranslations('captain');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    // Petit retard per evitar flicker de l'estat done quan es tanca.
    setTimeout(() => {
      setDone(false);
      setError(null);
    }, 200);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('locale', locale);
    if (typeof window !== 'undefined') {
      fd.set('pageUrl', window.location.href);
    }
    startTransition(async () => {
      const res = await reportIssue(fd);
      if (!res.ok) {
        if (res.error === 'rate_limited') setError(t('issue_rate_limited'));
        else if (res.error === 'unauthenticated') setError(t('issue_must_login'));
        else if (res.error === 'invalid_input') setError(t('issue_invalid'));
        else setError(t('issue_generic_error'));
        return;
      }
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-ink-900/90 border-crimson-500/40 hover:bg-crimson-600 fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors"
        aria-label={t('issue_button')}
      >
        <Bug className="size-4" />
        <span>{t('issue_button')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={dialogRef}
            className="bg-ink-950 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 p-6 text-white shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-display flex items-center gap-2 text-lg font-semibold">
                  <Bug className="text-crimson-400 size-5" />
                  {t('issue_modal_title')}
                </p>
                <p className="mt-1 text-xs text-white/65">{t('issue_modal_subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label="close"
              >
                <X className="size-4" />
              </button>
            </div>

            {done ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-400" />
                <p className="font-display text-base font-semibold">{t('issue_thanks_title')}</p>
                <p className="mt-1 text-xs text-white/65">{t('issue_thanks_body')}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                >
                  {t('issue_thanks_close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <p>{t('issue_guidelines')}</p>
                </div>

                <label className="block space-y-1 text-sm">
                  <span className="text-white/65">{t('issue_field_title')}</span>
                  <input
                    name="title"
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder={t('issue_field_title_placeholder')}
                    className="bg-ink-900/70 mt-1 h-10 w-full rounded-md border border-white/15 px-3 text-sm text-white/90"
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="text-white/65">{t('issue_field_description')}</span>
                  <textarea
                    name="description"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                    placeholder={t('issue_field_description_placeholder')}
                    className="bg-ink-900/70 mt-1 w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/90"
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="text-white/65">{t('issue_field_severity')}</span>
                  <select
                    name="severity"
                    defaultValue="medium"
                    className="bg-ink-900/70 mt-1 h-10 w-full rounded-md border border-white/15 px-3 text-sm text-white/90"
                  >
                    <option value="low">{t('issue_severity_low')}</option>
                    <option value="medium">{t('issue_severity_medium')}</option>
                    <option value="high">{t('issue_severity_high')}</option>
                    <option value="critical">{t('issue_severity_critical')}</option>
                  </select>
                </label>

                <p className="text-[11px] text-white/45">
                  {t('issue_context_hint', { path: pathname })}
                </p>

                {error && <p className="text-xs text-red-300">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={isPending}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                  >
                    {t('issue_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="bg-crimson-600 hover:bg-crimson-500 rounded-full px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {isPending ? t('issue_sending') : t('issue_send')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
