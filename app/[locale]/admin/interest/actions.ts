'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { getActiveFee, formatCents } from '@/lib/pricing';
import { absoluteUrl } from '@/lib/site-url';
import InterestAnnouncement from '@/lib/email/templates/interest-announcement';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthenticated' as const };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false as const, error: 'forbidden' as const };
  return { ok: true as const, supabase };
}

export async function deleteInterestSubscription(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('interest_subscriptions').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/interest', 'page');
  return { ok: true } as const;
}

export async function announceInterest() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: tournament } = await auth.supabase
    .from('tournaments')
    .select('id, registration_closes_at')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return { ok: false, error: 'unknown_tournament' } as const;

  const { data: rows } = await auth.supabase
    .from('interest_subscriptions')
    .select('id, email, locale')
    .eq('tournament_id', tournament.id);
  const subscribers = rows ?? [];
  if (subscribers.length === 0) return { ok: false, error: 'no_subscribers' } as const;

  const activeFee = await getActiveFee(tournament.id);

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const locale = subscriber.locale === 'es' ? 'es' : 'ca';
    const intlLocale = locale === 'ca' ? 'ca-ES' : 'es-ES';
    const closesAtLabel = new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'long',
      timeZone: 'Europe/Madrid',
    }).format(new Date(tournament.registration_closes_at));
    const feeLabel = activeFee ? (locale === 'ca' ? activeFee.label_ca : activeFee.label_es) : null;
    const feeAmountLabel = activeFee
      ? formatCents(activeFee.amount_per_player_cents, locale)
      : null;
    try {
      await sendEmail({
        to: subscriber.email,
        subject:
          locale === 'ca'
            ? 'Inscripcions obertes — V Torneig de Pàdel les Coves'
            : 'Inscripciones abiertas — V Torneo de Pádel les Coves',
        react: InterestAnnouncement({
          locale,
          registrationUrl: absoluteUrl(`/${locale}/inscripcio`),
          closesAtLabel,
          feeLabel,
          feeAmountLabel,
        }),
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, sent, failed, total: subscribers.length } as const;
}
