'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import IssueReportReceived from '@/lib/email/templates/issue-report-received';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { getSiteUrl } from '@/lib/site-url';

const Schema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  pageUrl: z.string().max(2048).optional().nullable(),
  locale: z.enum(['ca', 'es']),
});

export type ReportIssueResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'unauthenticated' | 'rate_limited' | string };

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'clubpadelvinroma@gmail.com';
const ADMIN_WA = process.env.WHATSAPP_ADMIN_NUMBER ?? null;

export async function reportIssue(formData: FormData): Promise<ReportIssueResult> {
  const parsed = Schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    severity: formData.get('severity'),
    pageUrl: (formData.get('pageUrl') as string | null) || null,
    locale: formData.get('locale'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const hdrs = await headers();
  const userAgent = (hdrs.get('user-agent') ?? '').slice(0, 500);

  // Recuperem un nom curt del capità si està vinculat a un players row.
  const { data: player } = await supabase
    .from('players')
    .select('first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const reporterName = player
    ? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim() || null
    : null;

  const insertPayload = {
    reporter_user_id: user.id,
    reporter_email: (user.email ?? '').toLowerCase(),
    reporter_name: reporterName,
    title: parsed.data.title,
    description: parsed.data.description,
    severity: parsed.data.severity,
    page_url: parsed.data.pageUrl,
    user_agent: userAgent || null,
    locale: parsed.data.locale,
  };

  const { error } = await supabase.from('issue_reports').insert(insertPayload);

  if (error) {
    // El trigger `issue_reports_check_rate` retorna error amb missatge
    // "rate_limited" si l'usuari ha enviat 5 reports en 24h.
    if (error.message?.includes('rate_limited')) {
      return { ok: false, error: 'rate_limited' };
    }
    return { ok: false, error: error.message };
  }

  // Notifiquem l'admin per correu + WhatsApp en paral·lel. Errors de
  // notificació no bloquegen el desat: el report ja és a la BD.
  const adminUrl = `${getSiteUrl()}/${parsed.data.locale}/admin/issues`;

  await Promise.allSettled([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `[Report capità] ${parsed.data.title}`,
      react: IssueReportReceived({
        reporterEmail: user.email ?? '',
        reporterName,
        title: parsed.data.title,
        description: parsed.data.description,
        severity: parsed.data.severity,
        pageUrl: parsed.data.pageUrl ?? null,
        userAgent: userAgent || null,
        adminUrl,
      }),
    }),
    ADMIN_WA
      ? sendWhatsApp({
          to: ADMIN_WA,
          text: [
            `🛠 Nou report del capità ${reporterName ?? user.email}`,
            `Gravetat: ${parsed.data.severity.toUpperCase()}`,
            `Títol: ${parsed.data.title}`,
            parsed.data.pageUrl ? `Pàgina: ${parsed.data.pageUrl}` : null,
            `\n${parsed.data.description.slice(0, 500)}${parsed.data.description.length > 500 ? '…' : ''}`,
            `\nRevisar: ${adminUrl}`,
          ]
            .filter(Boolean)
            .join('\n'),
        })
      : Promise.resolve(),
  ]);

  // Marquem el report com a notificat per si en algun moment volem distingir
  // entre desat-i-enviat o desat-i-fallat. Per ara n'hi ha prou amb el `id`.
  return { ok: true };
}
