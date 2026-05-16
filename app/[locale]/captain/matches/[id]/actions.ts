'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SetSchema = z.object({
  set: z.number().int().min(1).max(3),
  a: z.number().int().min(0).max(7),
  b: z.number().int().min(0).max(7),
});

const ScoreSchema = z.array(SetSchema).min(2).max(3);

function isValidPadelSet(games_a: number, games_b: number) {
  // 6-0..6-4 OK, 7-5 OK, 7-6 OK (TB), 6-6 NO, 5-7 OK
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
  if (!validated.success) {
    return { ok: false, error: 'invalid_score' } as const;
  }

  for (const set of validated.data) {
    if (!isValidPadelSet(set.a, set.b)) {
      return { ok: false, error: 'invalid_set_score' } as const;
    }
  }

  // Comprobar que hay un ganador (2 sets ganados)
  let setsA = 0;
  let setsB = 0;
  for (const s of validated.data) {
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }
  if (setsA < 2 && setsB < 2) {
    return { ok: false, error: 'no_winner' } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_match_report', {
    p_match_id: matchId,
    p_score: validated.data,
  });

  if (error) return { ok: false, error: error.message } as const;

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
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' } as const;
  }

  const when = new Date(parsed.data.newScheduledAt);
  if (when.getTime() <= Date.now()) {
    return { ok: false, error: 'new_date_must_be_future' } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('propose_reschedule', {
    p_match_id: parsed.data.matchId,
    p_new_scheduled_at: when.toISOString(),
    p_new_court_label: parsed.data.newCourtLabel ?? null,
    p_message: parsed.data.message ?? null,
  });
  if (error) return { ok: false, error: error.message } as const;

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
