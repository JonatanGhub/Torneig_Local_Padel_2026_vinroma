'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bug, Mail, ExternalLink, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateIssueReport, deleteIssueReport } from './actions';

export type IssueReport = {
  id: string;
  reporter_email: string;
  reporter_name: string | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  page_url: string | null;
  user_agent: string | null;
  locale: 'ca' | 'es' | null;
  status: 'new' | 'triaged' | 'accepted' | 'rejected' | 'fixed';
  admin_notes: string | null;
  pr_url: string | null;
  triaged_at: string | null;
  created_at: string;
};

export function IssueRow({ report, locale }: { report: IssueReport; locale: 'ca' | 'es' }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [expanded, setExpanded] = useState(report.status === 'new');
  const [notes, setNotes] = useState(report.admin_notes ?? '');
  const [prUrl, setPrUrl] = useState(report.pr_url ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function applyStatus(status: IssueReport['status'], confirmKey?: string) {
    if (confirmKey && !window.confirm(t(confirmKey as 'issues_confirm_reject'))) return;
    setError(null);
    const fd = new FormData();
    fd.set('id', report.id);
    fd.set('status', status);
    if (notes) fd.set('adminNotes', notes);
    if (prUrl) fd.set('prUrl', prUrl);
    startTransition(async () => {
      const res = await updateIssueReport(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(t('issues_confirm_delete'))) return;
    const fd = new FormData();
    fd.set('id', report.id);
    startTransition(async () => {
      await deleteIssueReport(fd);
      router.refresh();
    });
  }

  const date = new Date(report.created_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="border-border bg-card rounded-md border p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={report.severity} t={t} />
            <StatusBadge status={report.status} t={t} />
            <span className="text-muted-foreground text-[10px]">{date}</span>
          </div>
          <p className="truncate font-medium">{report.title}</p>
          <p className="text-muted-foreground text-xs">
            {report.reporter_name ?? report.reporter_email}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-sm">
          <div>
            <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
              {t('issues_description')}
            </p>
            <p className="whitespace-pre-wrap">{report.description}</p>
          </div>

          {report.page_url && (
            <div>
              <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                {t('issues_page')}
              </p>
              <a
                href={report.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                {report.page_url} <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href={`mailto:${report.reporter_email}`}
              className="text-muted-foreground inline-flex items-center gap-1 hover:underline"
            >
              <Mail className="size-3" /> {report.reporter_email}
            </a>
            {report.locale && (
              <span className="text-muted-foreground">locale: {report.locale}</span>
            )}
            {report.user_agent && (
              <span className="text-muted-foreground truncate" title={report.user_agent}>
                UA: {report.user_agent.slice(0, 50)}…
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t('issues_admin_notes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={4000}
                className="bg-background border-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t('issues_pr_url')}</span>
              <input
                type="url"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                maxLength={2048}
                placeholder="https://github.com/.../pull/123"
                className="bg-background border-input mt-1 h-9 w-full rounded-md border px-2 text-xs"
              />
            </label>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-xs"
            >
              <Trash2 className="size-3.5" />
              {t('issues_delete')}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyStatus('rejected', 'issues_confirm_reject')}
                disabled={isPending}
              >
                {t('issues_action_reject')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyStatus('triaged')}
                disabled={isPending}
              >
                {t('issues_action_triage')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyStatus('accepted')}
                disabled={isPending}
              >
                {t('issues_action_accept')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => applyStatus('fixed')}
                disabled={isPending}
              >
                {t('issues_action_fixed')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function SeverityBadge({
  severity,
  t,
}: {
  severity: IssueReport['severity'];
  t: (k: string) => string;
}) {
  const tone =
    severity === 'critical'
      ? 'border-red-500/60 bg-red-500/15 text-red-600 dark:text-red-300'
      : severity === 'high'
        ? 'border-orange-400/60 bg-orange-400/15 text-orange-700 dark:text-orange-300'
        : severity === 'medium'
          ? 'border-amber-400/60 bg-amber-400/15 text-amber-700 dark:text-amber-300'
          : 'border-border bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${tone}`}
    >
      <Bug className="size-3" />
      {t(`issues_severity_${severity}` as 'issues_severity_low')}
    </span>
  );
}

function StatusBadge({ status, t }: { status: IssueReport['status']; t: (k: string) => string }) {
  const tone =
    status === 'new'
      ? 'border-sky-400/60 bg-sky-400/15 text-sky-700 dark:text-sky-300'
      : status === 'triaged'
        ? 'border-amber-400/60 bg-amber-400/15 text-amber-700 dark:text-amber-300'
        : status === 'accepted'
          ? 'border-violet-400/60 bg-violet-400/15 text-violet-700 dark:text-violet-300'
          : status === 'fixed'
            ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300'
            : 'border-red-400/60 bg-red-400/15 text-red-700 dark:text-red-300';
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${tone}`}
    >
      {t(`issues_status_${status}` as 'issues_status_new')}
    </span>
  );
}
