'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categoryReadyForKnockout, generateKnockoutForCategory } from '@/lib/knockout';
import {
  notifyMatchValidatedWhatsApp,
  notifyValidatedToGroup,
  notifyMatchAnnulledWhatsApp,
} from '@/lib/whatsapp/notify';
import { notifyMatchValidated } from '@/lib/email/notify';
import { madridInputToISO } from '@/lib/format-date';

// Si el partit que s'acaba de resoldre era l'ÚLTIM de grup de la seva
// categoria, genera el quadre eliminatori automàticament — el mateix que ja
// fan els fluxos del capità (submitReport/submitWalkoverReport). Sense això,
// una categoria el darrer partit de la qual es tanca des del panell d'admin
// (acceptar un report, walkover o editar el resultat) es quedaria sense
// quadre fins que algú el generés a mà des del sorteig.
async function maybeGenerateKnockout(matchId: string): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: match } = await service
      .from('matches')
      .select('phase, category_id, status')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.phase !== 'group') return;
    if (match.status !== 'validated' && match.status !== 'walkover') return;
    if (await categoryReadyForKnockout(service, match.category_id)) {
      await generateKnockoutForCategory(service, match.category_id);
    }
  } catch (err) {
    console.warn('[knockout] auto-generate (admin action) failed', err);
  }
}

const WalkoverSchema = z.object({
  matchId: z.string().uuid(),
  winnerPairId: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});

const OverrideSetSchema = z.object({
  set: z.number().int().min(1).max(3),
  a: z.number().int().min(0).max(7),
  b: z.number().int().min(0).max(7),
});
const OverrideScoreSchema = z.array(OverrideSetSchema).min(2).max(3);

function isValidPadelSet(games_a: number, games_b: number) {
  if (games_a === 6 && games_b <= 4) return true;
  if (games_b === 6 && games_a <= 4) return true;
  if (games_a === 7 && (games_b === 5 || games_b === 6)) return true;
  if (games_b === 7 && (games_a === 5 || games_a === 6)) return true;
  return false;
}

export async function adminAcceptReport(formData: FormData) {
  const matchId = formData.get('matchId');
  const side = formData.get('side');
  if (typeof matchId !== 'string' || (side !== 'a' && side !== 'b')) {
    return { ok: false, error: 'invalid_input' } as const;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_accept_report', {
    p_match_id: matchId,
    p_side: side,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Notificació als capitans i al grup (igual que quan es valida normalment)
  await notifyMatchValidatedWhatsApp(matchId);
  await notifyValidatedToGroup(matchId);
  await maybeGenerateKnockout(matchId);

  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}

export async function setWalkover(formData: FormData) {
  const parsed = WalkoverSchema.safeParse({
    matchId: formData.get('matchId'),
    winnerPairId: formData.get('winnerPairId'),
    reason: (formData.get('reason') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_walkover', {
    p_match_id: parsed.data.matchId,
    p_winner_pair_id: parsed.data.winnerPairId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: error.message } as const;

  // Notificació als capitans i al grup (walkover inclòs)
  await notifyMatchValidatedWhatsApp(parsed.data.matchId);
  await notifyValidatedToGroup(parsed.data.matchId);
  await maybeGenerateKnockout(parsed.data.matchId);

  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}

// Permet a l'admin entrar/corregir directament el marcador d'un partit
// (p.ex. un error de transcripció, o introduir el resultat real d'un partit
// que no ha passat pel doble report dels capitans). Substitueix qualsevol
// report/sets previs pel marcador indicat i deixa el partit com 'validated'.
export async function adminOverrideScore(formData: FormData) {
  const matchId = formData.get('matchId');
  const rawScore = formData.get('score');
  if (typeof matchId !== 'string' || typeof rawScore !== 'string') {
    return { ok: false, error: 'invalid_input' } as const;
  }
  let parsedScore: unknown;
  try {
    parsedScore = JSON.parse(rawScore);
  } catch {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const validated = OverrideScoreSchema.safeParse(parsedScore);
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

  const reason = (formData.get('reason') as string | null) || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_override_score', {
    p_match_id: matchId,
    p_score: validated.data,
    p_reason: reason,
  });
  if (error) {
    const known = [
      'only_admin',
      'match_not_found',
      'invalid_score',
      'winner_locked_next_round_exists',
    ];
    const code = known.find((k) => error.message.includes(k)) ?? 'unknown';
    return { ok: false, error: code } as const;
  }

  await notifyMatchValidated(matchId);
  await notifyMatchValidatedWhatsApp(matchId);
  await notifyValidatedToGroup(matchId);
  await maybeGenerateKnockout(matchId);

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}

const AnnulSchema = z.object({
  matchId: z.string().uuid(),
  newScheduledAt: z.string().nullable().optional(),
  newCourtLabel: z.string().max(40).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

// Anul·la el resultat d'un partit ja jugat (validated/walkover/disputed/
// pending_validation): esborra reports i sets, buida el guanyador i el
// torna a 'scheduled' perquè es pugui tornar a jugar. Si l'admin indica una
// nova data en el mateix formulari, es fixa directament; si no, el partit
// queda sense programar i qualsevol dels dos capitans el pot reprogramar
// des del seu propi flux de "proposar canvi de data".
export async function annulMatchResult(formData: FormData) {
  const parsed = AnnulSchema.safeParse({
    matchId: formData.get('matchId'),
    newScheduledAt: (formData.get('newScheduledAt') as string | null) || null,
    newCourtLabel: (formData.get('newCourtLabel') as string | null) || null,
    reason: (formData.get('reason') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;

  const newScheduledAtIso = parsed.data.newScheduledAt
    ? madridInputToISO(parsed.data.newScheduledAt)
    : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_annul_match_result', {
    p_match_id: parsed.data.matchId,
    p_new_scheduled_at: newScheduledAtIso,
    p_new_court_label: newScheduledAtIso ? (parsed.data.newCourtLabel ?? null) : null,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) {
    const known = [
      'only_admin',
      'match_not_found',
      'match_not_played',
      'new_date_must_be_future',
      'court_double_booked',
      'pair_double_booked',
      'next_round_already_created',
    ];
    const code = known.find((k) => error.message.includes(k)) ?? 'unknown';
    return { ok: false, error: code } as const;
  }

  await notifyMatchAnnulledWhatsApp(parsed.data.matchId, parsed.data.reason ?? null);

  revalidatePath('/[locale]/admin/matches', 'page');
  revalidatePath('/[locale]/admin/disputes', 'page');
  revalidatePath('/[locale]/captain', 'page');
  revalidatePath('/[locale]/captain/matches/[id]', 'page');
  revalidatePath('/[locale]/calendari', 'page');
  revalidatePath('/[locale]/grups/[level]', 'page');
  return { ok: true } as const;
}

export async function adminResendMatchNotification(formData: FormData) {
  const matchId = formData.get('matchId');
  if (typeof matchId !== 'string' || !matchId) {
    return { ok: false, error: 'invalid_input' } as const;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if ((user?.app_metadata?.role as string | undefined) !== 'admin') {
    return { ok: false, error: 'forbidden' } as const;
  }

  // Re-envia les notificacions de resultat (validat o walkover).
  // La funció comprova internament l'estat del partit; és segur cridar-la
  // per a qualsevol matchId sense risc de notificacions falses.
  await notifyMatchValidatedWhatsApp(matchId);
  await notifyValidatedToGroup(matchId);
  return { ok: true } as const;
}
