'use client';

import { useState } from 'react';
import { Check, Copy, CalendarPlus, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CalendarSubscriptionCard({
  feedUrl,
  webcalUrl,
}: {
  feedUrl: string;
  webcalUrl: string;
}) {
  const t = useTranslations('captain');
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyToClipboard(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(feedUrl);
      return true;
    } catch {
      // Fallback per a contexts on no hi ha permis de clipboard.
      try {
        const fallback = document.createElement('textarea');
        fallback.value = feedUrl;
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        document.body.removeChild(fallback);
        return true;
      } catch {
        return false;
      }
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleProvider(provider: 'apple' | 'google' | 'outlook') {
    if (provider === 'apple') {
      // webcal:// obre Apple Calendar nadiu a iOS/macOS. Si el sistema no
      // gestiona el scheme, l'usuari igualment veu el feed; copiem com a
      // suport.
      await copyToClipboard();
      window.location.href = webcalUrl;
      return;
    }

    // Per a Google i Outlook: el deep link "cid=" de Google és poc fiable
    // ("Comprueba la URL"). El fluxe robust és copiar la URL al
    // portapapers i obrir la pàgina d'"afegir per URL" del proveïdor en
    // una nova pestanya. L'usuari només ha d'enganxar.
    const copyOk = await copyToClipboard();
    const url =
      provider === 'google'
        ? 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'
        : 'https://outlook.live.com/calendar/0/addfromweb';
    window.open(url, '_blank', 'noopener,noreferrer');

    const providerLabel = provider === 'google' ? 'Google Calendar' : 'Outlook';
    showToast(
      copyOk
        ? t('calendar_toast_paste', { provider: providerLabel })
        : t('calendar_toast_copy_failed'),
    );
  }

  async function handleCopyButton() {
    const ok = await copyToClipboard();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast(t('calendar_toast_copy_failed'));
    }
  }

  return (
    <section className="glass-card relative mb-6 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="bg-crimson-500/15 text-crimson-300 inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
          <CalendarPlus className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-white">
            {t('calendar_card_title')}
          </p>
          <p className="text-xs text-white/55">{t('calendar_card_body')}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ProviderButton
          onClick={() => handleProvider('apple')}
          label={t('calendar_provider_apple')}
          hint={t('calendar_provider_apple_hint')}
        />
        <ProviderButton
          onClick={() => handleProvider('google')}
          label="Google Calendar"
          hint={t('calendar_provider_google_hint_paste')}
        />
        <ProviderButton
          onClick={() => handleProvider('outlook')}
          label="Outlook"
          hint={t('calendar_provider_outlook_hint_paste')}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={feedUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="bg-ink-900/70 min-w-0 flex-1 truncate rounded-md border border-white/10 px-3 py-2 font-mono text-xs text-white/80"
        />
        <button
          type="button"
          onClick={handleCopyButton}
          className="bg-crimson-600 hover:bg-crimson-500 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              {t('calendar_copied')}
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              {t('calendar_copy_url')}
            </>
          )}
        </button>
      </div>

      <details className="mt-3 text-xs text-white/60">
        <summary className="cursor-pointer text-white/75 hover:text-white">
          {t('calendar_instructions_summary')}
        </summary>
        <div className="mt-2 space-y-2 pl-1">
          <p>
            <strong className="text-white/85">{t('calendar_provider_apple')}:</strong>{' '}
            {t('calendar_instr_apple')}
          </p>
          <p>
            <strong className="text-white/85">Google Calendar:</strong> {t('calendar_instr_google')}
          </p>
          <p>
            <strong className="text-white/85">Outlook:</strong> {t('calendar_instr_outlook')}
          </p>
        </div>
      </details>

      {toast && (
        <div
          role="status"
          className="bg-crimson-600 fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <Check className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </section>
  );
}

function ProviderButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:border-crimson-400/40 group flex flex-col gap-0.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
        {label}
        <ExternalLink className="size-3 text-white/40 group-hover:text-white/70" />
      </span>
      <span className="text-[11px] text-white/55">{hint}</span>
    </button>
  );
}
