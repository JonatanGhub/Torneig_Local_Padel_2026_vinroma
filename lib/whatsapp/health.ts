/**
 * Monitoratge de la connexió de WhatsApp (Evolution/Baileys).
 *
 * El cron /api/cron/wa-health crida checkWhatsAppHealth() cada ~30 min:
 *   1. Fa una prova REAL contra Evolution (no només connectionState, que pot
 *      mentir amb state:open mentre el socket és mort). La prova de debò és
 *      llegir la info del grup: durant una caiguda retorna "Connection Closed".
 *   2. Si falla, intenta auto-recuperar reiniciant la instància i re-prova.
 *   3. Si segueix caigut, envia un EMAIL d'alerta a l'administració (Resend és
 *      independent d'Evolution, així que l'avís sí que arriba). Dedup: re-avisa
 *      com a màxim cada REALERT_HOURS hores mentre segueix caigut.
 *   4. Quan es recupera, envia un email de "recuperat".
 *
 * L'estat es desa a la taula singleton whatsapp_health.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getSiteUrl } from '@/lib/site-url';
import { sendEmail } from '@/lib/email/send';
import WhatsAppHealthAlert from '@/lib/email/templates/whatsapp-health-alert';
import {
  whatsappConfigured,
  fetchConnectionStateRaw,
  fetchGroupInfoRaw,
  restartInstanceRaw,
} from './send';

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'clubpadelvinroma@gmail.com';
const ALERT_EMAILS = (process.env.WHATSAPP_ALERT_EMAILS ?? ADMIN_EMAIL)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Mentre segueix caigut, no repetim l'email més d'una vegada cada X hores.
const REALERT_HOURS = 3;
// Espera després del reinici automàtic abans de re-provar.
const RESTART_SETTLE_MS = 4_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Probe = { healthy: boolean; detail: string };

// Prova REAL: estat de connexió + lectura d'info del grup (operació que toca
// el socket de WhatsApp de debò). Sa = el grup respon 200 sense "Connection
// Closed". Si no hi ha grup configurat, ens limitem a l'estat de connexió.
async function probe(): Promise<Probe> {
  const state = await fetchConnectionStateRaw();
  let stateOpen = false;
  try {
    const o = JSON.parse(state.body) as { instance?: { state?: string } };
    stateOpen = o?.instance?.state === 'open';
  } catch {
    // body no JSON
  }

  const jid = process.env.WHATSAPP_GROUP_JID?.trim();
  if (jid) {
    const info = await fetchGroupInfoRaw(jid);
    const closed = info.body.includes('Connection Closed');
    const healthy = info.ok && !closed;
    return {
      healthy,
      detail: `state=${stateOpen ? 'open' : '?'} · groupInfo=HTTP ${info.status}${closed ? ' Connection Closed' : ''}`,
    };
  }
  return {
    healthy: stateOpen,
    detail: `state=${stateOpen ? 'open' : 'closed/unknown'} (sense WHATSAPP_GROUP_JID)`,
  };
}

async function sendAlert(status: 'down' | 'recovered', detail: string, restarted: boolean) {
  if (ALERT_EMAILS.length === 0) return;
  try {
    await sendEmail({
      to: ALERT_EMAILS,
      subject:
        status === 'down'
          ? '⚠️ WhatsApp del torneig CAIGUT — cal revisar Evolution'
          : '✅ WhatsApp del torneig recuperat',
      react: WhatsAppHealthAlert({
        status,
        detail,
        restarted,
        debugUrl: `${getSiteUrl()}/ca/admin/whatsapp-debug`,
      }),
    });
  } catch (err) {
    console.error('[wa-health] alert email failed', err);
  }
}

export type HealthResult = {
  ok: boolean;
  skipped?: string;
  healthy?: boolean;
  restarted?: boolean;
  alerted?: boolean;
  recovered?: boolean;
  detail?: string;
};

export async function checkWhatsAppHealth(): Promise<HealthResult> {
  if (!whatsappConfigured()) return { ok: true, skipped: 'not_configured' };

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('whatsapp_health')
    .select('is_healthy, last_alert_at')
    .eq('id', true)
    .maybeSingle();
  const wasHealthy = row?.is_healthy ?? true;

  let p = await probe();
  let restarted = false;

  // Auto-recuperació: si la prova falla, intenta un reinici i re-prova.
  if (!p.healthy) {
    console.warn('[wa-health] unhealthy, attempting restart', { detail: p.detail });
    await restartInstanceRaw();
    restarted = true;
    await sleep(RESTART_SETTLE_MS);
    p = await probe();
  }

  const now = new Date().toISOString();

  if (p.healthy) {
    await supabase.from('whatsapp_health').upsert({
      id: true,
      is_healthy: true,
      last_ok_at: now,
      last_detail: p.detail,
      updated_at: now,
    });
    // Si veníem de caiguda, avisa que s'ha recuperat.
    if (!wasHealthy) {
      await sendAlert('recovered', p.detail, restarted);
      await supabase.from('whatsapp_health').update({ last_alert_at: now }).eq('id', true);
      console.log('[wa-health] recovered', { detail: p.detail, restarted });
      return { ok: true, healthy: true, restarted, recovered: true, detail: p.detail };
    }
    return { ok: true, healthy: true, restarted, detail: p.detail };
  }

  // Segueix caigut després del reinici. Decidim si toca avisar (transició a
  // caigut, o ja fa REALERT_HOURS de l'últim avís).
  const lastAlertMs = row?.last_alert_at ? new Date(row.last_alert_at).getTime() : 0;
  const shouldAlert =
    wasHealthy || !row?.last_alert_at || Date.now() - lastAlertMs > REALERT_HOURS * 3_600_000;

  await supabase.from('whatsapp_health').upsert({
    id: true,
    is_healthy: false,
    last_failure_at: now,
    last_detail: p.detail,
    updated_at: now,
    ...(shouldAlert ? { last_alert_at: now } : {}),
  });

  if (shouldAlert) await sendAlert('down', p.detail, restarted);
  console.error('[wa-health] DOWN', { detail: p.detail, restarted, alerted: shouldAlert });
  return { ok: true, healthy: false, restarted, alerted: shouldAlert, detail: p.detail };
}
