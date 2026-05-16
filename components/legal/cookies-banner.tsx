'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

const STORAGE_KEY = 'cookie-consent-v1';

type Consent = {
  essential: true;
  analytics: boolean;
  decided_at: string;
};

function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (parsed && parsed.essential === true && typeof parsed.analytics === 'boolean') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeConsent(analytics: boolean) {
  if (typeof window === 'undefined') return;
  const value: Consent = { essential: true, analytics, decided_at: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  // Disparamos evento para que cualquier listener (analytics, etc.) reaccione.
  window.dispatchEvent(new CustomEvent('cookie-consent', { detail: value }));
}

export function CookiesBanner({ locale }: { locale: string }) {
  const t = useTranslations('cookies_banner');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readConsent() === null);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t('aria_label')}
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md"
    >
      <div className="liquid-glass-dark rounded-2xl p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-base font-semibold">{t('title')}</p>
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => {
              writeConsent(false);
              setOpen(false);
            }}
            className="text-white/60 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-white/75">
          {t('body')}{' '}
          <Link href={`/${locale}/cookies`} className="text-crimson-300 underline">
            {t('more')}
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              writeConsent(true);
              setOpen(false);
            }}
            className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-white"
          >
            {t('accept_all')}
          </button>
          <button
            type="button"
            onClick={() => {
              writeConsent(false);
              setOpen(false);
            }}
            className="liquid-glass inline-flex items-center rounded-full px-4 py-2 text-xs font-medium text-white"
          >
            {t('only_essential')}
          </button>
        </div>
      </div>
    </div>
  );
}
