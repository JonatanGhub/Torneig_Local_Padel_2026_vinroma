import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { computePerPairAmount, type ActiveFee } from '@/lib/pricing';
import {
  isMinor,
  RegistrationSchema,
  type RegistrationInput,
  type LegalGuardianInput,
  type PlayerInput,
} from '@/types/registration';

export type CreatePairOptions = {
  tournamentId: string;
  categoryId: string;
  fee: ActiveFee;
  pairStatus: 'pending_payment' | 'confirmed';
  paymentStatus: 'pending' | 'paid';
  reconciledBy?: string | null;
  notes?: string | null;
};

export type CreatedPair = {
  pair_id: string;
  primary_payment_reference: string;
  payment_references: string[];
  captain: { id: string; first_name: string | null; email: string | null };
  partner: { id: string; first_name: string | null; email: string | null };
};

export type CreatePairResult =
  | { ok: true; data: CreatedPair }
  | { ok: false; error: string; field_errors?: Record<string, string> };

function playerPayload(p: PlayerInput, guardian: LegalGuardianInput | undefined, signedAt: string) {
  return {
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
    consent_signed_at: signedAt,
  };
}

export async function createPairAndPlayers(
  supabase: SupabaseClient<Database>,
  input: RegistrationInput,
  options: CreatePairOptions,
): Promise<CreatePairResult> {
  const parsed = RegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { ok: false, error: 'validation_failed', field_errors: fieldErrors };
  }

  const data = parsed.data;

  if (isMinor(data.player_a.birth_date) && !data.guardian_a) {
    return { ok: false, error: 'guardian_a_required' };
  }
  if (isMinor(data.player_b.birth_date) && !data.guardian_b) {
    return { ok: false, error: 'guardian_b_required' };
  }

  const signedAt = new Date().toISOString();

  const consentRow = {
    consent_data_processing: data.consent_data_processing,
    consent_results_publication: data.consent_results_publication,
    consent_whatsapp: data.consent_whatsapp,
  };

  const { data: createdPlayers, error: playerErr } = await supabase
    .from('players')
    .insert([
      { ...playerPayload(data.player_a, data.guardian_a, signedAt), ...consentRow },
      { ...playerPayload(data.player_b, data.guardian_b, signedAt), ...consentRow },
    ])
    .select('id, first_name, last_name, email');

  if (playerErr || !createdPlayers || createdPlayers.length !== 2) {
    return { ok: false, error: playerErr?.message ?? 'players_insert_failed' };
  }

  const playerA = createdPlayers[0]!;
  const playerB = createdPlayers[1]!;
  const captainPlayer = data.captain === 'a' ? playerA : playerB;
  const partnerPlayer = data.captain === 'a' ? playerB : playerA;

  const { data: createdPair, error: pairErr } = await supabase
    .from('pairs')
    .insert({
      tournament_id: options.tournamentId,
      category_id: options.categoryId,
      player_a_id: playerA.id,
      player_b_id: playerB.id,
      captain_id: captainPlayer.id,
      status: options.pairStatus,
      fee_mode_chosen: data.fee_mode,
    })
    .select('id')
    .single();

  if (pairErr || !createdPair) {
    return { ok: false, error: pairErr?.message ?? 'pair_insert_failed' };
  }

  const paymentInserts =
    data.fee_mode === 'per_pair'
      ? [{ payer: captainPlayer, playerId: null }]
      : [
          { payer: playerA, playerId: playerA.id },
          { payer: playerB, playerId: playerB.id },
        ];

  const reconciledAt = options.paymentStatus === 'paid' ? signedAt : null;

  const paymentRows = await Promise.all(
    paymentInserts.map(async (p) => {
      const { data: ref } = await supabase.rpc('generate_payment_reference', {
        p_pair_id: createdPair.id,
        p_payer_player_id: p.payer.id,
        p_mode: data.fee_mode,
      });
      const amount =
        data.fee_mode === 'per_pair'
          ? computePerPairAmount(options.fee)
          : options.fee.amount_per_player_cents;
      return {
        pair_id: createdPair.id,
        player_id: p.playerId,
        payer_player_id: p.payer.id,
        fee_id: options.fee.id,
        method: 'bizum' as const,
        amount_cents: amount,
        reference_code: ref as string,
        status: options.paymentStatus,
        reconciled_by: options.reconciledBy ?? null,
        reconciled_at: reconciledAt,
        notes: options.notes ?? null,
      };
    }),
  );

  const { data: insertedPayments, error: payErr } = await supabase
    .from('payments')
    .insert(paymentRows)
    .select('reference_code');

  if (payErr || !insertedPayments || insertedPayments.length === 0) {
    return { ok: false, error: payErr?.message ?? 'payments_insert_failed' };
  }

  const refs = insertedPayments.map((p) => p.reference_code);

  return {
    ok: true,
    data: {
      pair_id: createdPair.id,
      primary_payment_reference: refs[0]!,
      payment_references: refs,
      captain: captainPlayer,
      partner: partnerPlayer,
    },
  };
}
