import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { IssueRow, type IssueReport } from './issue-row';

type Props = { params: Promise<{ locale: Locale }> };

export default async function IssuesAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data } = await supabase
    .from('issue_reports')
    .select(
      'id, reporter_email, reporter_name, title, description, severity, page_url, user_agent, locale, status, admin_notes, pr_url, triaged_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const reports = (data ?? []) as IssueReport[];
  const open = reports.filter(
    (r) => r.status === 'new' || r.status === 'triaged' || r.status === 'accepted',
  );
  const closed = reports.filter((r) => r.status === 'fixed' || r.status === 'rejected');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('issues_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('issues_subtitle')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          {t('issues_open_section')}{' '}
          <span className="text-muted-foreground text-xs font-normal">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">{t('issues_no_open')}</p>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => (
              <IssueRow key={r.id} report={r} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <details className="space-y-3">
          <summary className="text-muted-foreground cursor-pointer text-sm">
            {t('issues_closed_section', { count: closed.length })}
          </summary>
          <ul className="mt-3 space-y-2">
            {closed.map((r) => (
              <IssueRow key={r.id} report={r} locale={locale} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
