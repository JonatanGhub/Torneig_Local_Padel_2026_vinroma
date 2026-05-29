import { Resend } from 'resend';
import type { ReactElement } from 'react';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Torneig Pàdel les Coves <onboarding@resend.dev>';

// Reply-To per defecte (p.ex. el correu del club). Si es defineix, totes les
// respostes dels inscriptors hi arriben encara que el FROM sigui un altre
// domini verificat. Una crida concreta pot sobreescriure'l amb params.replyTo.
const DEFAULT_REPLY_TO = process.env.RESEND_REPLY_TO;

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
};

export async function sendEmail(params: SendEmailParams) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; email NOT sent', {
      to: params.to,
      subject: params.subject,
    });
    return { id: null, skipped: true } as const;
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    react: params.react,
    replyTo: params.replyTo ?? DEFAULT_REPLY_TO,
  });

  if (error) throw new Error(`[email] Resend failed: ${error.message}`);
  return { id: data?.id ?? null, skipped: false } as const;
}
