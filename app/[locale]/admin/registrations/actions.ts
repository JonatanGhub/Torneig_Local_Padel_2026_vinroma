'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveFee } from '@/lib/pricing';
import { createPairAndPlayers } from '@/lib/registration';
import { RegistrationSchema, type RegistrationInput } from '@/types/registration';

const AdminOptionsSchema = z.object({
  tournamentId: z.string().uuid(),
  categoryId: z.string().uuid(),
  locale: z.enum(['ca', 'es']),
  initialStatus: z.enum(['pending_payment', 'confirmed']),
  adminNotes: z.string().max(500).optional(),
});

export type AdminRegistrationResult =
  | { ok: true; pair_id: string }
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

  revalidatePath(`/${options.locale}/admin/registrations`);
  revalidatePath(`/${options.locale}/admin`);
  return { ok: true, pair_id: result.data.pair_id };
}
