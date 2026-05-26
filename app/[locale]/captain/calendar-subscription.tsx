'use client';

import { useState } from 'react';
import { Check, Copy, CalendarPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CalendarSubscriptionCard({
  feedUrl,
  webcalUrl,
}: {
  feedUrl: string;
  webcalUrl: string;
}) {
  const t = useTranslations('captain');
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const fallback = document.createElement('input');
      fallback.value = feedUrl;
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Google: subscribe-by-URL deep link. Funciona a Android, iOS web i desktop.
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  // Outlook web: addsubscription deep link.
  const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
    feedUrl,
  )}&name=${encodeURIComponent('Pàdel les Coves')}`;

  return (
    <section className="glass-card mb-6 rounded-2xl p-5">
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
          href={googleUrl}
          label="Google Calendar"
          hint={t('calendar_provider_google_hint')}
        />
        <ProviderButton
          href={webcalUrl}
          label={t('calendar_provider_apple')}
          hint={t('calendar_provider_apple_hint')}
        />
        <ProviderButton
          href={outlookUrl}
          label="Outlook"
          hint={t('calendar_provider_outlook_hint')}
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
          onClick={copyToClipboard}
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
      <p className="mt-3 text-xs text-white/45">{t('calendar_card_hint')}</p>
    </section>
  );
}

function ProviderButton({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:border-crimson-400/40 flex flex-col gap-0.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
    >
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className="text-[11px] text-white/55">{hint}</span>
    </a>
  );
}
