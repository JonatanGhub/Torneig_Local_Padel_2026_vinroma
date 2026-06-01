'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { madridInputToISO } from '@/lib/format-date';
import {
  notifyMatchDisputed,
  notifyMatchValidated,
  notifyRescheduleProposed,
  notifyResultPendingValidation,
} from '@/lib/email/notify';
import {
  notifyMatchDisputedWhatsApp,
  notifyMatchValidatedWhatsApp,
  notifyRescheduleAcceptedToGroup,
  notifyRescheduleProposedWhatsApp,
  notifyResultPendingValidationWhatsApp,
  notifyValidatedToGroup,
} from '@/lib/whatsapp/notify';

const SetSchema = z.object({
  set: z.number().int().min(1).max(3),
  a: z.number().int().min(0).max(7),
  b: z.number().int().min(0).max(7),
});

const ScoreSchema = z.array(SetSchema).min(2).max(3);

function isValidPadelSet(games_a: number, games_b: number) {
  if (games_a === 6 && games_b <= 4) return true;
  if (games_b === 6 && games_a <= 4) return true;
  if (games_a === 7 && (games_b === 5 || games_b === 6)) return true;
  if (games_b === 7 && (games_a === 5 || games_a === 6)) return true;
  return false;
}

export async function submitReport(formData: FormData) {
  const matchId = formData.get('matchId');
  const raw = formData.get('score');
  if (typeof matchId !== 'string' || typeof raw !== 'string') {
    return { ok: false, error: 'invalid_input' } as const;
  }
  let parsedScore: unknown;
  try {
    parsedScore = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid_json' } as const;
  }
  const validated = ScoreSchema.safeParse(parsedScore);
  if (!validated.success) return { ok: false, error: 'invalid_score' } as const;
  for (const set of validated.data) {
    if (!isValidPadelSet(set.a, set.b)) return { ok: false, error: 'invalid_set_score' } as const;
  }
  let setsA = 0;
  let setsB = 0;
  for (const s of validated.data) {
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }
  if (setsA < 2 && setsB < 2) return { ok: false, error: 'no_winner' } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_match_report', {
    p_match_id: matchId,
    p_score: validated.data,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Tras el RPC, el trigger ya ha actualizado matches.status. Releemos
  // para decidir qué notificar. Errores de email no rompen la mutación.
  const { data: matchAfter } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .maybeSingle();
  const reporterSide = data === 'a' || data === 'b' ? (data as 'a' | 'b') : null;
  if (matchAfter?.status === 'validated') {
    await notifyMatchValidated(matchId);
    await notifyMatchValidatedWhatsApp(matchId);
    await notifyValidatedToGroup(matchId);
  } else if (matchAfter?.status === 'disputed') {
    await notifyMatchDisputed(matchId);
    await notifyMatchDisputedWhatsApp(matchId);
  } else if (matchAfter?.status === 'pending_validation' && reporterSide) {
    // Primer report: avisa el capità rival perquè el confirmi.
    await notifyResultPendingValidation(matchId, reporterSide);
    await notifyResultPendingValidationWhatsApp(matchId, reporterSide);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true, side: data as string } as const;
}

const RescheduleSchema = z.object({
  matchId: z.string().uuid(),
  newScheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'invalid_date',
  }),
  newCourtLabel: z.string().max(80).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
});

export async function proposeReschedule(formData: FormData) {
  const parsed = RescheduleSchema.safeParse({
    matchId: formData.get('matchId'),
    newScheduledAt: formData.get('newScheduledAt'),
    newCourtLabel: (formData.get('newCourtLabel') as string | null) || null,
    message: (formData.get('message') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  // El valor ve d'un <input datetime-local> (hora de paret de Madrid). El
  // convertim a instant UTC tenint en compte el fus, no com a UTC directe.
  const whenISO = madridInputToISO(parsed.data.newScheduledAt);
  if (new Date(whenISO).getTime() <= Date.now()) {
    return { ok: false, error: 'new_date_must_be_future' } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('propose_reschedule', {
    p_match_id: parsed.data.matchId,
    p_new_scheduled_at: whenISO,
    p_new_court_label: parsed.data.newCourtLabel ?? null,
    p_message: parsed.data.message ?? null,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Notificar al capitán rival en background (errores no rompen la mutación).
  if (typeof data === 'string') {
    await notifyRescheduleProposed(data);
    await notifyRescheduleProposedWhatsApp(data);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  return { ok: true, proposalId: data as string } as const;
}

export async function respondToReschedule(formData: FormData) {
  const proposalId = formData.get('proposalId');
  const accept = formData.get('accept');
  if (typeof proposalId !== 'string' || (accept !== 'yes' && accept !== 'no')) {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('respond_to_reschedule', {
    p_proposal_id: proposalId,
    p_accept: accept === 'yes',
  });
  if (error) return { ok: false, error: error.message } as const;

  // Si la proposta s'accepta, avisem el grup de gestió (canvi confirmat).
  // Errors de WhatsApp no han de trencar la mutació principal.
  if (data === 'accepted') {
    await notifyRescheduleAcceptedToGroup(proposalId);
  }

  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  return { ok: true, status: data as string } as const;
}

export async function cancelReschedule(formData: FormData) {
  const proposalId = formData.get('proposalId');
  if (typeof proposalId !== 'string') {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_reschedule', {
    p_proposal_id: proposalId,
  });
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  return { ok: true, status: data as string } as const;
}
