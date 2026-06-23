'use server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsApp, sendWhatsAppToGroup, whatsappConfigured } from '@/lib/whatsapp/send';
import { sendDailyGroupSummary, notifyFeePhaseChangeToGroup } from '@/lib/whatsapp/notify';
import type {
  CronRunResult,
  GroupInfo,
  WhatsAppConfigSnapshot,
  WhatsAppDebugResult,
} from './types';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string | undefined) ?? null;
  return Boolean(user && role === 'admin');
}

function preview(s: string | null | undefined, keepStart = 4, keepEnd = 4): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.length <= keepStart + keepEnd + 1) return trimmed;
  return `${trimmed.slice(0, keepStart)}…${trimmed.slice(-keepEnd)}`;
}

export async function sendTestToGroup(): Promise<WhatsAppDebugResult> {
  if (!(await assertAdmin())) return { ok: false, target: 'group', reason: 'forbidden' };

  const text = `🧪 *Test des del panell admin*\nSi veus aquest missatge, l'enviament al grup funciona.\n(${new Date().toISOString()})`;
  const result = await sendWhatsAppToGroup(text);

  if (result.ok && !result.skipped) {
    return {
      ok: true,
      status: result.status ?? 200,
      target: 'group',
      sentAt: new Date().toISOString(),
    };
  }
  if (result.ok && result.skipped) {
    return { ok: false, target: 'group', reason: 'not_configured' };
  }
  return {
    ok: false,
    target: 'group',
    reason: 'api_error',
    error: result.error,
    status: result.status,
    body: result.body,
  };
}

export async function sendTestToNumber(formData: FormData): Promise<WhatsAppDebugResult> {
  if (!(await assertAdmin())) return { ok: false, target: 'dm', reason: 'forbidden' };

  const raw = (formData.get('phone') as string | null)?.trim() ?? '';
  if (!raw) return { ok: false, target: 'dm', reason: 'invalid_input' };

  const text = `🧪 *Test DM des del panell admin*\nSi reps aquest missatge, l'enviament DM funciona.\n(${new Date().toISOString()})`;
  const result = await sendWhatsApp({ to: raw, text });

  if (result.ok && !result.skipped) {
    return {
      ok: true,
      status: result.status ?? 200,
      target: 'dm',
      sentAt: new Date().toISOString(),
    };
  }
  if (result.ok && result.skipped) {
    return {
      ok: false,
      target: 'dm',
      reason: result.reason === 'invalid_number' ? 'invalid_number' : 'not_configured',
    };
  }
  return {
    ok: false,
    target: 'dm',
    reason: 'api_error',
    error: result.error,
    status: result.status,
    body: result.body,
  };
}

export async function getConfigSnapshot(): Promise<WhatsAppConfigSnapshot | null> {
  if (!(await assertAdmin())) return null;
  const apiUrl = process.env.EVOLUTION_API_URL ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY ?? null;
  const instance = process.env.EVOLUTION_INSTANCE ?? null;
  const groupJid = process.env.WHATSAPP_GROUP_JID ?? null;
  const cronSecret = process.env.CRON_SECRET ?? null;
  const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER ?? null;

  return {
    evolutionConfigured: whatsappConfigured(),
    apiUrlPresent: Boolean(apiUrl),
    apiUrlPreview: apiUrl ? apiUrl.replace(/\/$/, '') : null,
    apiKeyPresent: Boolean(apiKey),
    apiKeyLength: apiKey?.length ?? 0,
    instancePresent: Boolean(instance),
    instancePreview: instance,
    groupJidPresent: Boolean(groupJid),
    groupJidPreview: groupJid ? preview(groupJid, 6, 6) : null,
    groupJidLooksValid: Boolean(groupJid && /^[\w-]+@g\.us$/.test(groupJid.trim())),
    cronSecretPresent: Boolean(cronSecret),
    adminNumberPresent: Boolean(adminNumber),
  };
}

// Executa exactament la mateixa lògica que el cron diari
// (/api/cron/match-reminders), però sense passar pel CRON_SECRET. Útil per
// provar des d'admin sense esperar les 09:00. Cada funció ja captura els seus
// propis errors internament — això només informa de panics no recollits.
export async function triggerDailyCron(): Promise<CronRunResult | null> {
  if (!(await assertAdmin())) return null;

  const startedAt = new Date().toISOString();
  const result: CronRunResult = {
    ok: true,
    startedAt,
    finishedAt: startedAt,
    daily: { attempted: false },
    feePhase: { attempted: false },
  };

  try {
    result.daily.attempted = true;
    await sendDailyGroupSummary();
  } catch (err) {
    result.ok = false;
    result.daily.error = String(err);
  }

  try {
    result.feePhase.attempted = true;
    await notifyFeePhaseChangeToGroup();
  } catch (err) {
    result.ok = false;
    result.feePhase.error = String(err);
  }

  result.finishedAt = new Date().toISOString();
  return result;
}

// Comprova si la instància d'Evolution té el grup configurat. Falla amb un
// missatge útil si el JID no apareix entre els grups de la instància.
export async function fetchGroupInfo(): Promise<GroupInfo | null> {
  if (!(await assertAdmin())) return null;

  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY ?? null;
  const instance = process.env.EVOLUTION_INSTANCE ?? null;
  const groupJid = process.env.WHATSAPP_GROUP_JID?.trim() ?? null;

  if (!apiUrl || !apiKey || !instance) {
    return { ok: false, error: 'evolution_not_configured' };
  }
  if (!groupJid) {
    return { ok: false, error: 'group_jid_not_set' };
  }

  try {
    const res = await fetch(`${apiUrl}/group/fetchAllGroups/${instance}?getParticipants=true`, {
      method: 'GET',
      headers: { apikey: apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: body.slice(0, 300) };
    }
    type EvolutionGroup = { id: string; subject: string; size?: number };
    const groups = (await res.json()) as EvolutionGroup[];
    const matched = Array.isArray(groups) ? groups.find((g) => g.id === groupJid) : undefined;

    if (!matched) {
      return {
        ok: false,
        error: 'group_jid_not_in_instance',
        totalGroups: Array.isArray(groups) ? groups.length : undefined,
      };
    }

    return {
      ok: true,
      totalGroups: Array.isArray(groups) ? groups.length : undefined,
      matchedGroup: {
        id: matched.id,
        subject: matched.subject,
        size: matched.size,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
