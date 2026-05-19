'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import InscriptionConfirmed from '@/lib/email/templates/inscription-confirmed';
import { getActiveFee, formatCents, computePerPairAmount } from '@/lib/pricing';
import { createPairAndPlayers } from '@/lib/registration';
import { isCategoryFull } from '@/lib/category-capacity';
import type { RegistrationInput } from '@/types/registration';

export type RegistrationResult =
  | { ok: true; pair_id: string; primary_payment_reference: string }
  | { ok: false; error: string; field_errors?: Record<string, string> };

export async function submitRegistration(
  input: RegistrationInput,
  options: { tournamentId: string; locale: 'ca' | 'es'; categoryId: string },
): Promise<RegistrationResult> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('registration_opens_at, registration_closes_at, is_published')
    .eq('id', options.tournamentId)
    .maybeSingle();
  if (!tournament) {
    return { ok: false, error: 'unknown_tournament' };
  }
  if (!tournament.is_published) {
    return { ok: false, error: 'registration_not_open' };
  }
  const now = Date.now();
  if (now < new Date(tournament.registration_opens_at).getTime()) {
    return { ok: false, error: 'registration_not_open' };
  }
  if (now > new Date(tournament.registration_closes_at).getTime()) {
    return { ok: false, error: 'registration_window_closed' };
  }

  const fee = await getActiveFee(options.tournamentId);
  if (!fee) {
    return { ok: false, error: 'registration_closed' };
  }
  if (!fee.is_default_open) {
    return { ok: false, error: 'fee_out_of_window' };
  }

  const { data: category } = await supabase
    .from('categories')
    .select('max_pairs')
    .eq('id', options.categoryId)
    .maybeSingle();
  if (!category) {
    return { ok: false, error: 'unknown_category' };
  }
  if (
    await isCategoryFull(supabase, options.tournamentId, options.categoryId, category.max_pairs)
  ) {
    return { ok: false, error: 'category_full' };
  }

  const result = await createPairAndPlayers(supabase, input, {
    tournamentId: options.tournamentId,
    categoryId: options.categoryId,
    fee,
    pairStatus: 'pending_payment',
    paymentStatus: 'pending',
  });

  if (!result.ok) {
    return result;
  }

  const { pair_id, primary_payment_reference, captain, partner } = result.data;
  const amountForEmail =
    input.fee_mode === 'per_pair' ? computePerPairAmount(fee) : fee.amount_per_player_cents;
  const feeLabel = options.locale === 'ca' ? fee.label_ca : fee.label_es;
  const paymentUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${options.locale}/p/${primary_payment_reference}`;

  try {
    if (!captain.email) throw new Error('captain_email_missing');
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
  } catch (err) {
    console.error('[registration] confirmation email failed', err);
  }

  return { ok: true, pair_id, primary_payment_reference };
}

export async function submitAndRedirect(
  formData: FormData,
  options: { tournamentId: string; locale: 'ca' | 'es'; categoryId: string },
) {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') throw new Error('missing_payload');
  const input = JSON.parse(raw) as RegistrationInput;

  const result = await submitRegistration(input, options);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(`/${options.locale}/p/${result.primary_payment_reference}`);
}
