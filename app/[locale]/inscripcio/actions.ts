'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import InscriptionConfirmed from '@/lib/email/templates/inscription-confirmed';
import { getActiveFee, formatCents, computePerPairAmount } from '@/lib/pricing';
import { isMinor, RegistrationSchema, type RegistrationInput } from '@/types/registration';

export type RegistrationResult =
  | { ok: true; pair_id: string; primary_payment_reference: string }
  | { ok: false; error: string; field_errors?: Record<string, string> };

export async function submitRegistration(
  input: RegistrationInput,
  options: { tournamentId: string; locale: 'ca' | 'es'; categoryId: string },
): Promise<RegistrationResult> {
  const parsed = RegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { ok: false, error: 'validation_failed', field_errors: fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const fee = await getActiveFee(options.tournamentId);
  if (!fee) {
    return { ok: false, error: 'registration_closed' };
  }
  if (!fee.is_default_open) {
    return { ok: false, error: 'fee_out_of_window' };
  }

  // Detectar menores y verificar guardián
  const aIsMinor = isMinor(data.player_a.birth_date);
  const bIsMinor = isMinor(data.player_b.birth_date);
  if (aIsMinor && !data.guardian_a) {
    return { ok: false, error: 'guardian_a_required' };
  }
  if (bIsMinor && !data.guardian_b) {
    return { ok: false, error: 'guardian_b_required' };
  }

  // Crear los 2 players
  const playerPayload = (p: typeof data.player_a, guardian?: typeof data.guardian_a) => ({
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    birth_date: p.birth_date,
    declared_level: p.declared_level,
    legal_guardian_name: guardian?.legal_guardian_name ?? null,
    legal_guardian_dni: guardian?.legal_guardian_dni ?? null,
    legal_guardian_phone: guardian?.legal_guardian_phone ?? null,
    legal_guardian_email: guardian?.legal_guardian_email ?? null,
    consent_data_processing: data.consent_data_processing,
    consent_results_publication: data.consent_results_publication,
    consent_whatsapp: data.consent_whatsapp,
    consent_signed_at: new Date().toISOString(),
  });

  const { data: createdPlayers, error: playerErr } = await supabase
    .from('players')
    .insert([
      playerPayload(data.player_a, data.guardian_a),
      playerPayload(data.player_b, data.guardian_b),
    ])
    .select('id, first_name, last_name, email');

  if (playerErr || !createdPlayers || createdPlayers.length !== 2) {
    return { ok: false, error: playerErr?.message ?? 'players_insert_failed' };
  }

  const playerA = createdPlayers[0]!;
  const playerB = createdPlayers[1]!;
  const captainPlayer = data.captain === 'a' ? playerA : playerB;

  const { data: createdPair, error: pairErr } = await supabase
    .from('pairs')
    .insert({
      tournament_id: options.tournamentId,
      category_id: options.categoryId,
      player_a_id: playerA.id,
      player_b_id: playerB.id,
      captain_id: captainPlayer.id,
      status: 'pending_payment',
      fee_mode_chosen: data.fee_mode,
    })
    .select('id')
    .single();

  if (pairErr || !createdPair) {
    return { ok: false, error: pairErr?.message ?? 'pair_insert_failed' };
  }

  // Generar payments según modo
  const paymentInserts =
    data.fee_mode === 'per_pair'
      ? [{ payer: captainPlayer, playerId: null }]
      : [
          { payer: playerA, playerId: playerA.id },
          { payer: playerB, playerId: playerB.id },
        ];

  const paymentRows = await Promise.all(
    paymentInserts.map(async (p) => {
      const { data: ref } = await supabase.rpc('generate_payment_reference', {
        p_pair_id: createdPair.id,
        p_payer_player_id: p.payer.id,
        p_mode: data.fee_mode,
      });
      const amount =
        data.fee_mode === 'per_pair' ? computePerPairAmount(fee) : fee.amount_per_player_cents;
      return {
        pair_id: createdPair.id,
        player_id: p.playerId,
        payer_player_id: p.payer.id,
        fee_id: fee.id,
        method: 'bizum' as const,
        amount_cents: amount,
        reference_code: ref as string,
        status: 'pending' as const,
      };
    }),
  );

  const { data: insertedPayments, error: payErr } = await supabase
    .from('payments')
    .insert(paymentRows)
    .select('reference_code');

  if (payErr || !insertedPayments) {
    return { ok: false, error: payErr?.message ?? 'payments_insert_failed' };
  }

  const primaryRef = insertedPayments[0]!.reference_code;
  const paymentUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${options.locale}/p/${primaryRef}`;

  const amountForEmail =
    data.fee_mode === 'per_pair' ? computePerPairAmount(fee) : fee.amount_per_player_cents;
  const feeLabel = options.locale === 'ca' ? fee.label_ca : fee.label_es;

  // Email de confirmación de inscripción al capitán (no bloqueante)
  try {
    if (!captainPlayer.email) throw new Error('captain_email_missing');
    await sendEmail({
      to: captainPlayer.email,
      subject: 'Inscripció rebuda — V Torneig Pàdel les Coves',
      react: InscriptionConfirmed({
        recipientName: captainPlayer.first_name ?? '',
        partnerName:
          (captainPlayer.id === playerA.id ? playerB.first_name : playerA.first_name) ?? '',
        categoryLabel: `Categoria ${data.category_level}ª`,
        paymentUrl,
        amountLabel: formatCents(amountForEmail, options.locale),
        feeLabel,
      }),
    });
  } catch (err) {
    console.error('[registration] confirmation email failed', err);
  }

  return { ok: true, pair_id: createdPair.id, primary_payment_reference: primaryRef };
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
