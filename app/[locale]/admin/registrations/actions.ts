'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import InscriptionConfirmed from '@/lib/email/templates/inscription-confirmed';
import { getActiveFee, formatCents, computePerPairAmount } from '@/lib/pricing';
import { createPairAndPlayers } from '@/lib/registration';
import { RegistrationSchema, type RegistrationInput } from '@/types/registration';

const AdminOptionsSchema = z.object({
  tournamentId: z.string().uuid(),
  categoryId: z.string().uuid(),
  locale: z.enum(['ca', 'es']),
  initialStatus: z.enum(['pending_payment', 'confirmed']),
  adminNotes: z.string().max(500).optional(),
  sendCaptainEmail: z.boolean().optional(),
});

export type AdminRegistrationResult =
  | { ok: true; pair_id: string; email_sent: boolean; email_error?: string }
  | { ok: false; error: string; field_errors?: Record<string, string> };

export async function adminCreateRegistration(
  rawInput: unknown,
  rawOptions: unknown,
): Promise<AdminRegistrationResult> {
  const inputParsed = RegistrationSchema.safeParse(rawInput);
  const optionsParsed = AdminOptionsSchema.safeParse(rawOptions);
  if (!inputParsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of inputParsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { ok: false, error: 'validation_failed', field_errors: fieldErrors };
  }
  if (!optionsParsed.success) {
    return { ok: false, error: 'invalid_options' };
  }
  const input: RegistrationInput = inputParsed.data;
  const options = optionsParsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'unauthenticated' };
  }
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role !== 'admin') {
    return { ok: false, error: 'forbidden' };
  }

  const fee = await getActiveFee(options.tournamentId);
  if (!fee) {
    return { ok: false, error: 'no_active_fee' };
  }

  const paymentStatus = options.initialStatus === 'confirmed' ? 'paid' : 'pending';
  const reconciledBy = paymentStatus === 'paid' ? user.id : null;
  const notes = options.adminNotes ? `[admin] ${options.adminNotes}` : '[admin] manual';

  const result = await createPairAndPlayers(supabase, input, {
    tournamentId: options.tournamentId,
    categoryId: options.categoryId,
    fee,
    pairStatus: options.initialStatus,
    paymentStatus,
    reconciledBy,
    notes,
  });

  if (!result.ok) {
    return result;
  }

  let emailSent = false;
  let emailError: string | undefined;
  const shouldSendEmail =
    options.sendCaptainEmail === true && options.initialStatus === 'pending_payment';
  if (shouldSendEmail) {
    const { primary_payment_reference, captain, partner } = result.data;
    if (!captain.email) {
      emailError = 'captain_email_missing';
    } else {
      const amountForEmail =
        input.fee_mode === 'per_pair' ? computePerPairAmount(fee) : fee.amount_per_player_cents;
      const feeLabel = options.locale === 'ca' ? fee.label_ca : fee.label_es;
      const paymentUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${options.locale}/p/${primary_payment_reference}`;
      try {
        await sendEmail({
          to: captain.email,
          subject: 'Inscripció rebuda — V Torneig Pàdel les Coves',
          react: InscriptionConfirmed({
            recipientName: captain.first_name ?? '',
            partnerName: partner.first_name ?? '',
            categoryLabel: `Categoria ${input.category_level}ª`,
            paymentUrl,
            amountLabel: formatCents(amountForEmail, options.locale),
            feeLabel,
          }),
        });
        emailSent = true;
      } catch (err) {
        console.error('[admin-registration] confirmation email failed', err);
        emailError = 'send_failed';
      }
    }
  }

  revalidatePath(`/${options.locale}/admin/registrations`);
  revalidatePath(`/${options.locale}/admin`);
  return {
    ok: true,
    pair_id: result.data.pair_id,
    email_sent: emailSent,
    ...(emailError ? { email_error: emailError } : {}),
  };
}
