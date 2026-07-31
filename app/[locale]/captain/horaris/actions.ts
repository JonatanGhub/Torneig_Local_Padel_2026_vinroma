'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { getCaptainPlayerIds } from '@/lib/captain/data';
import { KO_PREF_SLOTS } from '@/lib/scheduling/official-slots';
import { notifySchedulePreferenceWhatsApp } from '@/lib/whatsapp/notify';

const SLOT_KEYS = KO_PREF_SLOTS as [string, ...string[]];

const PrefsSchema = z.object({
  pairId: z.string().uuid(),
  // Només les franges oficials (dl-dc × 19:00/20:30/22:00) i els 2 estats.
  slotPrefs: z.record(z.enum(SLOT_KEYS), z.enum(['ok', 'no'])),
  note: z.string().max(500).nullable(),
});

export type SavePreferenceResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'not_captain' | string };

export async function saveSchedulePreference(formData: FormData): Promise<SavePreferenceResult> {
  let rawPrefs: unknown;
  try {
    rawPrefs = JSON.parse(String(formData.get('slotPrefs') ?? '{}'));
  } catch {
    return { ok: false, error: 'invalid_input' };
  }
  const parsed = PrefsSchema.safeParse({
    pairId: formData.get('pairId'),
    slotPrefs: rawPrefs,
    note: (formData.get('note') as string | null)?.trim() || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  // Només el capità de la parella (identitat per correu, igual que la resta
  // de fluxos de capità) pot desar-ne les preferències.
  const { user, playerIds } = await getCaptainPlayerIds();
  if (!user || playerIds.length === 0) return { ok: false, error: 'not_captain' };

  const service = createServiceClient();
  const { data: pair } = await service
    .from('pairs')
    .select('id, captain_id')
    .eq('id', parsed.data.pairId)
    .maybeSingle();
  if (!pair || !playerIds.includes(pair.captain_id)) {
    return { ok: false, error: 'not_captain' };
  }

  const { error } = await service.from('knockout_schedule_preferences').upsert({
    pair_id: parsed.data.pairId,
    updated_by_player_id: pair.captain_id,
    day_prefs: parsed.data.slotPrefs,
    note: parsed.data.note,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  // Avís centralitzat a l'admin — substitueix els privats de WhatsApp.
  await notifySchedulePreferenceWhatsApp(
    parsed.data.pairId,
    parsed.data.slotPrefs,
    parsed.data.note,
  );

  revalidatePath('/[locale]/captain/horaris', 'page');
  revalidatePath('/[locale]/admin/preferences', 'page');
  return { ok: true };
}
