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
      // clipboard API blocked — fallback: select the text via a hidden input
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

  return (
    <section className="glass-card mb-6 rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
              {t('calendar_copy')}
            </>
          )}
        </button>
        <a
          href={webcalUrl}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10"
        >
          {t('calendar_add_to_app')}
        </a>
      </div>
      <p className="mt-3 text-xs text-white/45">{t('calendar_card_hint')}</p>
    </section>
  );
}
