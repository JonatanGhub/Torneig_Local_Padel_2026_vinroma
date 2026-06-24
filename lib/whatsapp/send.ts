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

async function evolutionFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number = EVOLUTION_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
export async function sendWhatsAppToGroup(
  text: string,
  overrideJid?: string,
): Promise<SendWhatsAppResult> {
  const groupJid = (overrideJid ?? process.env.WHATSAPP_GROUP_JID)?.trim() || null;
  if (!whatsappConfigured()) {
    console.error('[whatsapp:group] EVOLUTION_* not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }
  if (!groupJid) {
    console.error('[whatsapp:group] WHATSAPP_GROUP_JID not set; group message NOT sent');
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  try {
    const res = await evolutionFetch(
      `/message/sendText/${INSTANCE}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
        body: JSON.stringify({ number: groupJid, text }),
      },
      90_000,
    );
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

// Descobreix grups SENSE passar per fetchAllGroups (que fa 504 perquè
// consulta WhatsApp en viu). En comptes d'això:
//   1. POST /chat/findChats — llegeix els chats de la BD LOCAL d'Evolution
//      (instantani). D'aquí n'extraiem els remoteJid acabats en @g.us.
//   2. Per cada JID de grup, GET /group/findGroupInfos (ràpid, cachejat) per
//      obtenir el nom (subject).
// Retorna la llista [{ id, subject }] i la loga.
export type DiscoveredGroup = { id: string; subject: string };

export async function discoverGroups(): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  chatsCount?: number;
  groups: DiscoveredGroup[];
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, error: 'evolution_not_configured', groups: [] };
  }

  // 1) findChats. A v2 és POST amb cos opcional; fem fallback a GET.
  let chatsBody = '';
  let chatsStatus = 0;
  try {
    let res = await evolutionFetch(
      `/chat/findChats/${INSTANCE}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
        body: JSON.stringify({}),
      },
      30_000,
    );
    if (res.status === 404 || res.status === 405) {
      res = await evolutionFetch(`/chat/findChats/${INSTANCE}`, {
        method: 'GET',
        headers: { apikey: API_KEY! },
      });
    }
    chatsStatus = res.status;
    chatsBody = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[wa-discover] findChats non-2xx', {
        status: res.status,
        body: chatsBody.slice(0, 300),
      });
      return { ok: false, status: res.status, error: chatsBody.slice(0, 300), groups: [] };
    }
  } catch (err) {
    console.error('[wa-discover] findChats threw', { error: String(err) });
    return { ok: false, status: 0, error: String(err), groups: [] };
  }

  // 2) Extreure remoteJid de grup (acaben en @g.us) del cos de findChats.
  const groupJids = new Set<string>();
  try {
    const parsed = JSON.parse(chatsBody) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)?.chats)
        ? ((parsed as Record<string, unknown>).chats as unknown[])
        : [];
    for (const c of arr) {
      if (typeof c !== 'object' || c === null) continue;
      const o = c as Record<string, unknown>;
      const candidate =
        (typeof o.remoteJid === 'string' && o.remoteJid) ||
        (typeof o.id === 'string' && o.id) ||
        (typeof o.jid === 'string' && o.jid) ||
        '';
      if (candidate.endsWith('@g.us')) groupJids.add(candidate);
    }
  } catch {
    // si no és JSON, ho reportem com a error perquè no podem continuar
    console.error('[wa-discover] findChats body not JSON', { body: chatsBody.slice(0, 300) });
    return {
      ok: false,
      status: chatsStatus,
      error: 'findChats body not JSON',
      groups: [],
    };
  }

  const jids = Array.from(groupJids);
  console.log(`[wa-discover] findChats OK: ${jids.length} grups detectats`);

  // 3) Resoldre el subject de cada grup amb findGroupInfos (concurrència 6).
  const groups: DiscoveredGroup[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < jids.length; i += CONCURRENCY) {
    const batch = jids.slice(i, i + CONCURRENCY);
    const resolved = await Promise.all(
      batch.map(async (jid) => {
        const info = await fetchGroupInfoRaw(jid);
        let subject = '';
        if (info.ok) {
          try {
            const o = JSON.parse(info.body) as Record<string, unknown>;
            if (typeof o.subject === 'string') subject = o.subject;
          } catch {
            // ignore
          }
        }
        return { id: jid, subject };
      }),
    );
    groups.push(...resolved);
  }

  groups.sort((a, b) => a.subject.localeCompare(b.subject, 'ca', { sensitivity: 'base' }));
  console.log(
    `[wa-discover] ${groups.length} grups resolts:\n` +
      groups.map((g) => `${g.subject} => ${g.id}`).join('\n'),
  );

  return { ok: true, status: 200, chatsCount: jids.length, groups };
}

// Llista tots els grups que coneix la instància. Útil per descobrir el JID
// real quan el configurat no funciona.
//
// IMPORTANT sobre el timeout: el backend d'Evolution és lent recopilant tots
// els grups (pot tardar > 60s la PRIMERA vegada, i el seu nginx talla amb un
// 504). Però aquella primera crida ESCALFA la cache interna d'Evolution, així
// que crides posteriors són ràpides. Per això loguem el resultat (compacte)
// tan bon punt arriba: encara que el client mòbil abandoni la connexió, la
// funció serverless continua fins a `maxDuration` i, si Evolution respon dins
// d'aquesta finestra, els JIDs queden als runtime logs de Vercel.
export async function fetchAllGroupsRaw(timeoutMs = 290_000): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const res = await evolutionFetch(
      `/group/fetchAllGroups/${INSTANCE}?getParticipants=false`,
      { method: 'GET', headers: { apikey: API_KEY! } },
      timeoutMs,
    );
    const body = await res.text().catch(() => '');
    // Log compacte de subject => id per poder llegir-ho dels runtime logs
    // sense dependre que la UI rebi la resposta.
    if (res.ok) {
      try {
        const parsed = JSON.parse(body) as unknown;
        if (Array.isArray(parsed)) {
          const lines = parsed
            .map((g) => {
              if (typeof g !== 'object' || g === null) return null;
              const o = g as Record<string, unknown>;
              const id = typeof o.id === 'string' ? o.id : '?';
              const subject = typeof o.subject === 'string' ? o.subject : '';
              return `${subject} => ${id}`;
            })
            .filter(Boolean);
          console.log(`[wa-groups] ${lines.length} grups:\n${lines.join('\n')}`);
        }
      } catch {
        // body no parseable; igualment el retornem cru
      }
    } else {
      console.error('[wa-groups] fetchAllGroups non-2xx', {
        status: res.status,
        body: body.slice(0, 300),
      });
    }
    return { ok: res.ok, status: res.status, body: body.slice(0, 200_000) };
  } catch (err) {
    console.error('[wa-groups] fetchAllGroups threw', { error: String(err) });
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
