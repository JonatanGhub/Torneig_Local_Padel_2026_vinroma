'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  sendWhatsApp,
  sendWhatsAppToGroup,
  whatsappConfigured,
  fetchGroupInfoRaw,
  fetchAllGroupsRaw,
  fetchConnectionStateRaw,
  discoverGroups,
  restartInstanceRaw,
  connectInstanceRaw,
  logoutInstanceRaw,
  recreateInstanceRaw,
  type ConnectInstanceResult,
  type RecreateInstanceResult,
} from '@/lib/whatsapp/send';
import {
  sendDailyGroupSummary,
  notifyFeePhaseChangeToGroup,
  notifyMatchValidatedWhatsApp,
  notifyValidatedToGroup,
  notifyResultPendingValidationWhatsApp,
  notifyMatchDisputedWhatsApp,
} from '@/lib/whatsapp/notify';
import type {
  CronRunResult,
  DiscoverGroupsResult,
  GroupListEntry,
  RawEvolutionResponse,
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

export async function sendTestToGroup(overrideJid?: string): Promise<WhatsAppDebugResult> {
  if (!(await assertAdmin())) return { ok: false, target: 'group', reason: 'forbidden' };

  const jid = overrideJid?.trim() || undefined;
  const text = `🧪 *Test des del panell admin*\nSi veus aquest missatge, l'enviament al grup funciona.\n(${new Date().toISOString()})`;
  const result = await sendWhatsAppToGroup(text, jid);

  if (result.ok && !result.skipped) {
    return {
      ok: true,
      status: result.status ?? 200,
      target: 'group',
      sentAt: new Date().toISOString(),
      responseBody: result.responseBody,
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
      responseBody: result.responseBody,
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
    groupJidFull: groupJid ? groupJid.trim() : null,
    groupJidLooksValid: Boolean(groupJid && /^[\w-]+@g\.us$/.test(groupJid.trim())),
    cronSecretPresent: Boolean(cronSecret),
    adminNumberPresent: Boolean(adminNumber),
  };
}

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

// Pregunta a Evolution per l'estat de la connexió de la instància. Si surt
// "close" o "connecting", el bot està desconnectat de WhatsApp i cap missatge
// (DM ni grup) s'envia realment, encara que l'API retorni 200 OK.
export async function checkConnectionState(): Promise<RawEvolutionResponse | null> {
  if (!(await assertAdmin())) return null;
  return fetchConnectionStateRaw();
}

// Llegeix info d'un grup específic. Si retorna 404 / not found, el bot no
// està al grup o el JID és incorrecte.
export async function checkGroupInfo(overrideJid?: string): Promise<RawEvolutionResponse | null> {
  if (!(await assertAdmin())) return null;
  const jid = overrideJid?.trim() || process.env.WHATSAPP_GROUP_JID?.trim();
  if (!jid) return { ok: false, status: 0, body: 'WHATSAPP_GROUP_JID not set' };
  return fetchGroupInfoRaw(jid);
}

// Descobreix grups via findChats (BD local) + findGroupInfos. Ràpid, evita
// el 504 de fetchAllGroups.
export async function discoverGroupsAction(): Promise<DiscoverGroupsResult | null> {
  if (!(await assertAdmin())) return null;
  return discoverGroups();
}

// Reinicia la instància d'Evolution per netejar l'estat de sessió encallat.
// És la recuperació estàndard quan els enviaments al grup es pengen (504) però
// els DMs i la lectura d'info del grup funcionen. NO cal re-escanejar el QR.
export async function restartInstanceAction(): Promise<RawEvolutionResponse | null> {
  if (!(await assertAdmin())) return null;
  return restartInstanceRaw();
}

// Força reconnexió REAL del socket. Si el dispositiu està desvinculat, retorna
// un QR + codi d'emparellament per tornar a vincular. És la recuperació quan
// `restart` diu state:open però tot falla amb "Connection Closed".
export async function connectInstanceAction(): Promise<ConnectInstanceResult | null> {
  if (!(await assertAdmin())) return null;
  return connectInstanceRaw();
}

// Logout (opció nuclear): tanca la sessió perquè la propera connexió generi un
// QR net. Després cal clicar "Reconnectar / obtenir QR".
export async function logoutInstanceAction(): Promise<RawEvolutionResponse | null> {
  if (!(await assertAdmin())) return null;
  return logoutInstanceRaw();
}

// Recrea la instància (delete + create) quan està en estat zombie i ni logout
// ni connect la desencallen. Retorna el QR per re-vincular.
export async function recreateInstanceAction(): Promise<RecreateInstanceResult | null> {
  if (!(await assertAdmin())) return null;
  return recreateInstanceRaw();
}

// Re-envia les notificacions de resultat (validated o walkover) per a un
// matchId concret. Útil per recuperar missatges perduts quan Evolution estava
// desconnectat en el moment de la validació.
export async function resendMatchNotification(
  matchId: string,
): Promise<{ ok: boolean; error?: string; sent?: string }> {
  if (!(await assertAdmin())) return { ok: false, error: 'forbidden' };
  const trimmed = matchId.trim();
  if (!trimmed || !/^[0-9a-f-]{36}$/.test(trimmed)) return { ok: false, error: 'invalid_uuid' };
  try {
    // Detecta l'estat del partit i re-envia la notificació adequada.
    const service = createServiceClient();
    const { data: match } = await service
      .from('matches')
      .select('status')
      .eq('id', trimmed)
      .maybeSingle();
    if (!match) return { ok: false, error: 'match_not_found' };

    if (match.status === 'validated' || match.status === 'walkover') {
      await notifyMatchValidatedWhatsApp(trimmed);
      await notifyValidatedToGroup(trimmed);
      return { ok: true, sent: `validat/walkover` };
    }

    if (match.status === 'pending_validation') {
      // Cal saber quin costat va reportar per avisar el RIVAL perquè confirmi.
      const { data: report } = await service
        .from('match_reports')
        .select('reporter_pair_side')
        .eq('match_id', trimmed)
        .in('reporter_pair_side', ['a', 'b'])
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const side = report?.reporter_pair_side;
      if (side !== 'a' && side !== 'b') return { ok: false, error: 'no_report_found' };
      await notifyResultPendingValidationWhatsApp(trimmed, side);
      return { ok: true, sent: `pendent de validar (avís al rival)` };
    }

    if (match.status === 'disputed') {
      await notifyMatchDisputedWhatsApp(trimmed);
      return { ok: true, sent: `disputa (avís a admin)` };
    }

    return { ok: false, error: `estat '${match.status}' sense notificació` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Llista tots els grups que el bot coneix. Útil per descobrir el JID real
// del grup quan el configurat no funciona. Tarda força — té timeout de 15s.
export async function listAllGroups(): Promise<{
  raw: RawEvolutionResponse;
  groups: GroupListEntry[] | null;
}> {
  if (!(await assertAdmin())) {
    return { raw: { ok: false, status: 0, body: 'forbidden' }, groups: null };
  }
  const raw = await fetchAllGroupsRaw();
  if (!raw.ok) return { raw, groups: null };

  try {
    const parsed = JSON.parse(raw.body) as unknown;
    if (!Array.isArray(parsed)) return { raw, groups: null };
    const groups: GroupListEntry[] = parsed
      .map((g) => {
        if (typeof g !== 'object' || g === null) return null;
        const obj = g as Record<string, unknown>;
        const id = typeof obj.id === 'string' ? obj.id : null;
        const subject = typeof obj.subject === 'string' ? obj.subject : '';
        return id ? { id, subject } : null;
      })
      .filter((g): g is GroupListEntry => g !== null);
    return { raw, groups };
  } catch {
    return { raw, groups: null };
  }
}
