'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import InscriptionConfirmed from '@/lib/email/templates/inscription-confirmed';
import { notifyInscriptionReceivedWhatsApp } from '@/lib/whatsapp/notify';
import { formatCents, computePerPairAmount, type ActiveFee } from '@/lib/pricing';
import { absoluteUrl } from '@/lib/site-url';

const InputSchema = z.object({
  pairId: z.string().uuid(),
  locale: z.enum(['ca', 'es']),
});

export type ResendEmailResult = { ok: true } | { ok: false; error: string };

export async function adminResendPaymentEmail(rawInput: unknown): Promise<ResendEmailResult> {
  const parsed = InputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { pairId, locale } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role !== 'admin') return { ok: false, error: 'forbidden' };

  const { data: pair, error: pairErr } = await supabase
    .from('pairs')
    .select(
      'id, status, fee_mode_chosen, captain_id, player_a_id, player_b_id, category_id, tournament_id',
    )
    .eq('id', pairId)
    .maybeSingle();

  if (pairErr || !pair) return { ok: false, error: 'pair_not_found' };
  if (pair.status !== 'pending_payment') return { ok: false, error: 'not_pending_payment' };

  const { data: payment } = await supabase
    .from('payments')
    .select('id, reference_code, fee_id, amount_cents, status')
    .eq('pair_id', pair.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!payment) return { ok: false, error: 'no_pending_payment' };

  const partnerId = pair.captain_id === pair.player_a_id ? pair.player_b_id : pair.player_a_id;
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, email')
    .in('id', [pair.captain_id, partnerId]);

  const captain = players?.find((p) => p.id === pair.captain_id);
  const partner = players?.find((p) => p.id === partnerId);
  if (!captain) return { ok: false, error: 'captain_not_found' };
  if (!captain.email) return { ok: false, error: 'captain_email_missing' };

  const { data: category } = await supabase
    .from('categories')
    .select('level')
    .eq('id', pair.category_id ?? '')
    .maybeSingle();

  const { data: fee } = await supabase
    .from('tournament_fees')
    .select(
      'id, tournament_id, label_ca, label_es, starts_at, ends_at, amount_per_player_cents, is_default_open',
    )
    .eq('id', payment.fee_id)
    .maybeSingle();

  if (!fee) return { ok: false, error: 'fee_not_found' };

  const activeFee: ActiveFee = fee;
  const amountForEmail =
    pair.fee_mode_chosen === 'per_pair'
      ? computePerPairAmount(activeFee)
      : activeFee.amount_per_player_cents;
  const feeLabel = locale === 'ca' ? activeFee.label_ca : activeFee.label_es;
  const paymentUrl = absoluteUrl(`/${locale}/p/${payment.reference_code}`);

  try {
    await sendEmail({
      to: captain.email,
      subject: 'Recordatori d’inscripció — V Torneig Pàdel les Coves',
      react: InscriptionConfirmed({
        recipientName: captain.first_name ?? '',
        partnerName: partner?.first_name ?? '',
        categoryLabel: category ? `Categoria ${category.level}ª` : 'Categoria',
        paymentUrl,
        amountLabel: formatCents(amountForEmail, locale),
        feeLabel,
      }),
    });
  } catch (err) {
    console.error('[admin-resend-email] failed', err);
    return { ok: false, error: 'send_failed' };
  }

  // WhatsApp paral·lel al capità (si té consent_whatsapp). No bloqueja el OK.
  await notifyInscriptionReceivedWhatsApp({
    pairId: pair.id,
    paymentReference: payment.reference_code,
    amountLabel: formatCents(amountForEmail, locale),
    categoryLabel: category ? `Categoria ${category.level}ª` : 'Categoria',
    locale,
  });

  revalidatePath(`/${locale}/admin/registrations`);
  return { ok: true };
}
