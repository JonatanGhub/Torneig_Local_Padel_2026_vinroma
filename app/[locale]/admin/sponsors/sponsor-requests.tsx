'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, Mail, Phone, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { approveSponsorRequest, rejectSponsorRequest, deleteSponsorRequest } from './actions';

export type SponsorRequest = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
  role_ca: string | null;
  role_es: string | null;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export function SponsorRequestsList({ requests }: { requests: SponsorRequest[] }) {
  const t = useTranslations('admin');
  const pending = requests.filter((r) => r.status === 'pending');
  const reviewed = requests.filter((r) => r.status !== 'pending');

  if (requests.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('sponsor_requests_title')}</h2>
        <p className="text-muted-foreground text-sm">{t('sponsor_requests_subtitle')}</p>
      </header>

      {pending.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{t('sponsor_requests_no_pending')}</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <Row key={r.id} req={r} />
          ))}
        </ul>
      )}

      {reviewed.length > 0 && (
        <details className="mt-4">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {t('sponsor_requests_history', { count: reviewed.length })}
          </summary>
          <ul className="mt-2 space-y-2">
            {reviewed.map((r) => (
              <ReviewedRow key={r.id} req={r} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Row({ req }: { req: SponsorRequest }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: typeof approveSponsorRequest | typeof rejectSponsorRequest,
    confirmKey?: string,
  ) {
    if (confirmKey && !window.confirm(t(confirmKey as 'sponsor_requests_confirm_approve'))) return;
    setError(null);
    const fd = new FormData();
    fd.set('id', req.id);
    if (notes) fd.set('adminNotes', notes);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="border-border bg-card rounded-md border p-4">
      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={req.logo_url}
          alt={req.name}
          loading="lazy"
          className="border-border h-20 w-20 shrink-0 rounded-md border bg-white/5 object-contain p-1"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            {req.name}
            <span className="text-muted-foreground ml-2 inline-flex rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase">
              {t(`sponsors_tier_${req.tier}` as 'sponsors_tier_gold')}
            </span>
          </p>
          {req.website_url && (
            <a
              href={req.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
            >
              {req.website_url} <ExternalLink className="size-3" />
            </a>
          )}
          {(req.role_ca || req.role_es) && (
            <p className="text-muted-foreground text-xs">
              {req.role_ca && <span>CA: {req.role_ca}</span>}
              {req.role_ca && req.role_es && <span> · </span>}
              {req.role_es && <span>ES: {req.role_es}</span>}
            </p>
          )}
          <p className="border-border mt-2 border-t pt-2 text-xs">
            <span className="font-medium">{req.submitter_name}</span>{' '}
            <a
              href={`mailto:${req.submitter_email}`}
              className="text-muted-foreground inline-flex items-center gap-1 hover:underline"
            >
              <Mail className="size-3" /> {req.submitter_email}
            </a>
            {req.submitter_phone && (
              <>
                {' '}
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Phone className="size-3" /> {req.submitter_phone}
                </span>
              </>
            )}
          </p>
          {req.message && (
            <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap italic">
              “{req.message}”
            </p>
          )}
        </div>
      </div>

      <div className="border-border mt-3 space-y-2 border-t pt-3">
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">{t('sponsor_requests_admin_notes')}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            className="bg-background border-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
          />
        </label>
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => run(rejectSponsorRequest, 'sponsor_requests_confirm_reject')}
            disabled={isPending}
            className="text-destructive"
          >
            <X className="mr-1 size-3.5" />
            {t('sponsor_requests_reject')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => run(approveSponsorRequest, 'sponsor_requests_confirm_approve')}
            disabled={isPending}
          >
            <Check className="mr-1 size-3.5" />
            {t('sponsor_requests_approve')}
          </Button>
        </div>
      </div>
    </li>
  );
}

function ReviewedRow({ req }: { req: SponsorRequest }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(t('sponsor_requests_confirm_delete'))) return;
    const fd = new FormData();
    fd.set('id', req.id);
    startTransition(async () => {
      await deleteSponsorRequest(fd);
      router.refresh();
    });
  }

  return (
    <li className="border-border bg-muted/30 flex items-center justify-between rounded-md border p-2 text-xs">
      <div>
        <span
          className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase ${
            req.status === 'approved'
              ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300'
              : 'border-red-400/50 bg-red-400/10 text-red-600 dark:text-red-300'
          }`}
        >
          {t(`sponsor_requests_status_${req.status}` as 'sponsor_requests_status_approved')}
        </span>
        <span className="font-medium">{req.name}</span>
        <span className="text-muted-foreground"> · {req.submitter_email}</span>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="text-muted-foreground hover:text-destructive"
        aria-label="delete"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
