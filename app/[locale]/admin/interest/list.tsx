'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Send, Trash2 } from 'lucide-react';
import type { Locale } from '@/i18n';
import { Button } from '@/components/ui/button';
import { announceInterest, deleteInterestSubscription } from './actions';

type Subscription = {
  id: string;
  email: string;
  locale: string;
  source: string | null;
  created_at: string;
};

export function InterestList({
  subscriptions,
  locale,
}: {
  subscriptions: Subscription[];
  locale: Locale;
}) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [isAnnouncing, startAnnounce] = useTransition();
  const [announceFeedback, setAnnounceFeedback] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleAnnounce() {
    if (!window.confirm(t('interest_confirm_announce'))) return;
    setAnnounceFeedback(null);
    startAnnounce(async () => {
      const result = await announceInterest();
      if (result.ok) {
        setAnnounceFeedback(
          t('interest_announce_result', { sent: result.sent, failed: result.failed }),
        );
      } else {
        setAnnounceFeedback(`${t('interest_announce_error')}: ${result.error}`);
      }
    });
  }
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Madrid',
      }),
    [locale],
  );

  function handleDelete(id: string) {
    if (!window.confirm(t('interest_confirm_delete'))) return;
    setPendingId(id);
    const formData = new FormData();
    formData.set('id', id);
    startTransition(async () => {
      await deleteInterestSubscription(formData);
      setPendingId(null);
    });
  }

  function exportCsv() {
    const header = 'email,locale,source,created_at\n';
    const body = subscriptions
      .map((s) => [s.email, s.locale, s.source ?? '', s.created_at].map(csvEscape).join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interested-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t('interest_count', { count: subscriptions.length })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAnnounce}
            disabled={subscriptions.length === 0 || isAnnouncing}
          >
            <Send className="size-3.5" />
            {isAnnouncing ? t('interest_announce_sending') : t('interest_announce_cta')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={subscriptions.length === 0}
          >
            <Download className="size-3.5" />
            {t('interest_export_csv')}
          </Button>
        </div>
      </div>
      {announceFeedback && <p className="text-muted-foreground text-xs">{announceFeedback}</p>}

      {subscriptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('interest_empty')}</p>
      ) : (
        <div className="border-border overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left">{t('interest_col_email')}</th>
                <th className="px-3 py-2 text-left">{t('interest_col_locale')}</th>
                <th className="px-3 py-2 text-left">{t('interest_col_source')}</th>
                <th className="px-3 py-2 text-left">{t('interest_col_created')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-border border-t">
                  <td className="px-3 py-2 font-mono">{s.email}</td>
                  <td className="px-3 py-2 uppercase">{s.locale}</td>
                  <td className="text-muted-foreground px-3 py-2">{s.source ?? '—'}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {formatter.format(new Date(s.created_at))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      disabled={isPending && pendingId === s.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
