/**
 * Client mínim per a Evolution API (WhatsApp self-hosted).
 *
 * Config per variables d'entorn (MAI hardcodejar l'apikey):
 *   EVOLUTION_API_URL    p.ex. https://evo.neonexai.com
 *   EVOLUTION_API_KEY    apikey de la instance
 *   EVOLUTION_INSTANCE   nom de la instance amb el número connectat
 *
 * Si falta qualsevol, sendWhatsApp és un no-op (igual que sendEmail sense
 * RESEND_API_KEY). Mai llança: un fallo de WhatsApp no ha de trencar la
 * mutació principal (resultat, reschedule, etc.).
 */

const API_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? null;
const API_KEY = process.env.EVOLUTION_API_KEY ?? null;
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? null;

export function whatsappConfigured(): boolean {
  return Boolean(API_URL && API_KEY && INSTANCE);
}

/**
 * Normalitza un telèfon espanyol a format Evolution (dígits amb prefix de
 * país, sense '+'). Retorna null si no sembla un número vàlid.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('34') && digits.length === 11) return digits; // 34 + 9
  if (digits.length === 9) return `34${digits}`; // mòbil/fix nacional
  if (digits.length >= 11) return digits; // ja internacional
  return null;
}

export type SendWhatsAppResult =
  | { ok: true; skipped: false }
  | { ok: true; skipped: true; reason: 'not_configured' | 'invalid_number' }
  | { ok: false; skipped: false; error: string };

export async function sendWhatsApp({
  to,
  text,
}: {
  to: string | null | undefined;
  text: string;
}): Promise<SendWhatsAppResult> {
  if (!whatsappConfigured()) {
    console.warn('[whatsapp] EVOLUTION_* not set; message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }
  const number = toWhatsAppNumber(to);
  if (!number) {
    console.warn('[whatsapp] invalid phone; skipped');
    return { ok: true, skipped: true, reason: 'invalid_number' };
  }

  try {
    const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
      // Format Evolution API v2.
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Evolution API ${res.status}: ${errBody.slice(0, 200)}`);
    }
    return { ok: true, skipped: false };
  } catch (err) {
    console.warn('[whatsapp] send failed', err);
    return { ok: false, skipped: false, error: String(err) };
  }
}

/**
 * Envia un missatge al grup de gestió de WhatsApp.
 *
 * A Evolution API el JID d'un grup té el format `<digits>-<digits>@g.us` i
 * NO s'ha de passar per `toWhatsAppNumber` (que esborra els caràcters no
 * numèrics i el trencaria). Per això tenim una funció separada que envia
 * directament el JID al camp `number` (l'API v2 accepta tant números
 * individuals com JIDs de grup).
 *
 * Config:
 *   WHATSAPP_GROUP_JID  JID del grup (p.ex. 34600000000-1700000000@g.us)
 *
 * No-op silenciós (ok: true, skipped) si Evolution o el JID no estan
 * configurats. Mai llança.
 */
export async function sendWhatsAppToGroup(text: string): Promise<SendWhatsAppResult> {
  const groupJid = process.env.WHATSAPP_GROUP_JID ?? null;
  if (!whatsappConfigured()) {
    console.warn('[whatsapp] EVOLUTION_* not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }
  if (!groupJid) {
    console.warn('[whatsapp] WHATSAPP_GROUP_JID not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
      // Evolution API v2 accepta JID de grup (`...@g.us`) al camp `number`.
      body: JSON.stringify({ number: groupJid, text }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Evolution API ${res.status}: ${errBody.slice(0, 200)}`);
    }
    return { ok: true, skipped: false };
  } catch (err) {
    console.warn('[whatsapp] group send failed', err);
    return { ok: false, skipped: false, error: String(err) };
  }
}
