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

// Timeout per a totes les crides a Evolution. Sense això, si Evolution està
// pengat el server action també es penja i la UI mostra spinner per sempre.
const EVOLUTION_TIMEOUT_MS = 15_000;

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
  | { ok: true; skipped: false; status?: number; responseBody?: string }
  | { ok: true; skipped: true; reason: 'not_configured' | 'invalid_number' }
  | { ok: false; skipped: false; error: string; status?: number; body?: string };

async function evolutionFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVOLUTION_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendWhatsApp({
  to,
  text,
}: {
  to: string | null | undefined;
  text: string;
}): Promise<SendWhatsAppResult> {
  if (!whatsappConfigured()) {
    console.error('[whatsapp:dm] EVOLUTION_* not set; message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }
  const number = toWhatsAppNumber(to);
  if (!number) {
    console.error('[whatsapp:dm] invalid phone; skipped', { to });
    return { ok: true, skipped: true, reason: 'invalid_number' };
  }

  try {
    const res = await evolutionFetch(`/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
      body: JSON.stringify({ number, text }),
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[whatsapp:dm] Evolution API non-2xx', {
        status: res.status,
        body: bodyText.slice(0, 500),
        number,
      });
      return {
        ok: false,
        skipped: false,
        error: `Evolution API ${res.status}: ${bodyText.slice(0, 200)}`,
        status: res.status,
        body: bodyText.slice(0, 500),
      };
    }
    return { ok: true, skipped: false, status: res.status, responseBody: bodyText.slice(0, 1000) };
  } catch (err) {
    console.error('[whatsapp:dm] send threw', { error: String(err), number });
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
  const groupJid = process.env.WHATSAPP_GROUP_JID?.trim() ?? null;
  if (!whatsappConfigured()) {
    console.error('[whatsapp:group] EVOLUTION_* not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }
  if (!groupJid) {
    console.error('[whatsapp:group] WHATSAPP_GROUP_JID not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  try {
    const res = await evolutionFetch(`/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
      body: JSON.stringify({ number: groupJid, text }),
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[whatsapp:group] Evolution API non-2xx', {
        status: res.status,
        body: bodyText.slice(0, 500),
        groupJid,
        instance: INSTANCE,
      });
      return {
        ok: false,
        skipped: false,
        error: `Evolution API ${res.status}: ${bodyText.slice(0, 200)}`,
        status: res.status,
        body: bodyText.slice(0, 500),
      };
    }
    // Evolution v2 retorna 200/201 amb la metadata del missatge inclús quan el
    // missatge està en cua i NO s'ha entregat realment (cas típic: bot fora
    // del grup o sessió de Baileys trencada). Loguem el cos sempre per poder
    // veure `status: PENDING` o codis similars sense haver d'inspeccionar el
    // servidor d'Evolution.
    console.log('[whatsapp:group] Evolution accepted', {
      status: res.status,
      body: bodyText.slice(0, 500),
      groupJid,
    });
    return { ok: true, skipped: false, status: res.status, responseBody: bodyText.slice(0, 1000) };
  } catch (err) {
    console.error('[whatsapp:group] send threw', {
      error: String(err),
      groupJid,
      instance: INSTANCE,
    });
    return { ok: false, skipped: false, error: String(err) };
  }
}

// Crida directa a Evolution per llegir informació d'un grup específic.
// Útil per diagnòstic: si retorna 404 / not found, el bot no està al grup o
// el JID és incorrecte. Si retorna info, el bot SÍ pot llegir el grup.
export async function fetchGroupInfoRaw(groupJid: string): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const url = `/group/findGroupInfos/${INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`;
    const res = await evolutionFetch(url, { method: 'GET', headers: { apikey: API_KEY! } });
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: body.slice(0, 2000) };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
}

// Llista tots els grups que coneix la instància. Útil per descobrir el JID
// real quan el configurat no funciona.
export async function fetchAllGroupsRaw(): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const res = await evolutionFetch(`/group/fetchAllGroups/${INSTANCE}?getParticipants=false`, {
      method: 'GET',
      headers: { apikey: API_KEY! },
    });
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: body.slice(0, 8000) };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
}

// Mostra l'estat de la connexió de la instància (CONNECTED, DISCONNECTED, etc.).
// Si el bot està desconnectat, els missatges SÍ retornen 200 OK però mai
// s'envien — això és la causa més comuna de "POST 200 però res no arriba".
export async function fetchConnectionStateRaw(): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const res = await evolutionFetch(`/instance/connectionState/${INSTANCE}`, {
      method: 'GET',
      headers: { apikey: API_KEY! },
    });
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: body.slice(0, 1000) };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
}
