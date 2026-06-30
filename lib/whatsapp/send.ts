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

// Reintents per a DMs quan Evolution retorna "Connection Closed" (la sessió
// de Baileys s'ha caigut momentàniament). Màxim 2 reintents, 1.5s entre ells.
const DM_MAX_RETRIES = 2;
const DM_RETRY_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isConnectionClosed(status: number, body: string): boolean {
  return status === 500 && body.includes('Connection Closed');
}

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

  let lastResult: SendWhatsAppResult = { ok: false, skipped: false, error: 'unknown' };

  for (let attempt = 0; attempt <= DM_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`[whatsapp:dm] retry ${attempt}/${DM_MAX_RETRIES} after Connection Closed`, {
        number,
      });
      await sleep(DM_RETRY_DELAY_MS);
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
          attempt,
        });
        lastResult = {
          ok: false,
          skipped: false,
          error: `Evolution API ${res.status}: ${bodyText.slice(0, 200)}`,
          status: res.status,
          body: bodyText.slice(0, 500),
        };
        // Reintent només per "Connection Closed" (caiguda transitòria de sessió)
        if (isConnectionClosed(res.status, bodyText)) continue;
        break;
      }
      // Log sempre (inclús en èxit) per detectar el cas "200 OK però mai entregat"
      // que Evolution retorna quan la sessió Baileys està degradada. El cos conté
      // el `status` del missatge (p.ex. PENDING/SENT/ERROR) que permet distingir-ho.
      console.log('[whatsapp:dm] Evolution accepted', {
        status: res.status,
        body: bodyText.slice(0, 500),
        number,
      });
      return {
        ok: true,
        skipped: false,
        status: res.status,
        responseBody: bodyText.slice(0, 1000),
      };
    } catch (err) {
      console.error('[whatsapp:dm] send threw', { error: String(err), number, attempt });
      lastResult = { ok: false, skipped: false, error: String(err) };
      // Errors de xarxa: reintent
    }
  }

  return lastResult;
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

// Reinicia la instància d'Evolution. Això força Baileys a reconnectar-se amb
// les credencials JA guardades (NO cal tornar a escanejar el QR) i, sobretot,
// neteja l'estat de sessió que s'hagi quedat penjat. És la recuperació estàndard
// quan la instància pot llegir grups i enviar DMs però els enviaments a un grup
// gran es pengen (504): la distribució de sender-keys / sessions de Signal del
// grup s'ha quedat encallada i un restart la torna a sincronitzar.
//
//   POST /instance/restart/{instance}
//
// Timeout llarg perquè el restart pot trigar uns segons a tornar a connectar.
export async function restartInstanceRaw(): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const res = await evolutionFetch(
      `/instance/restart/${INSTANCE}`,
      { method: 'POST', headers: { apikey: API_KEY! } },
      60_000,
    );
    const body = await res.text().catch(() => '');
    if (res.ok) {
      console.log('[whatsapp:restart] instance restarted', {
        status: res.status,
        body: body.slice(0, 300),
        instance: INSTANCE,
      });
    } else {
      console.error('[whatsapp:restart] non-2xx', {
        status: res.status,
        body: body.slice(0, 300),
        instance: INSTANCE,
      });
    }
    return { ok: res.ok, status: res.status, body: body.slice(0, 1000) };
  } catch (err) {
    console.error('[whatsapp:restart] threw', { error: String(err), instance: INSTANCE });
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

// Força una reconnexió REAL del socket de Baileys i, si el dispositiu està
// desvinculat, retorna un QR + codi d'emparellament per tornar-lo a vincular.
//
//   GET /instance/connect/{instance}
//
// És el pas de recuperació quan `restart` retorna `state: open` però totes les
// operacions reals fallen amb "Connection Closed" (sessió zombie). A diferència
// de restart, connect reobre el WebSocket i, si les credencials ja no són
// vàlides (WhatsApp ha desvinculat el dispositiu), genera un QR nou.
//
// Resposta típica:
//   - Si cal re-vincular: { pairingCode, code, base64, count }
//   - Si ja està connectat: { instance: { state: 'open' } }
export type ConnectInstanceResult = {
  ok: boolean;
  status: number;
  body: string;
  pairingCode: string | null;
  qrBase64: string | null;
  qrCode: string | null;
};

export async function connectInstanceRaw(): Promise<ConnectInstanceResult> {
  if (!whatsappConfigured()) {
    return {
      ok: false,
      status: 0,
      body: 'evolution_not_configured',
      pairingCode: null,
      qrBase64: null,
      qrCode: null,
    };
  }
  try {
    const res = await evolutionFetch(
      `/instance/connect/${INSTANCE}`,
      { method: 'GET', headers: { apikey: API_KEY! } },
      30_000,
    );
    const body = await res.text().catch(() => '');

    let pairingCode: string | null = null;
    let qrBase64: string | null = null;
    let qrCode: string | null = null;
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (typeof parsed.pairingCode === 'string') pairingCode = parsed.pairingCode;
      if (typeof parsed.base64 === 'string') qrBase64 = parsed.base64;
      if (typeof parsed.code === 'string') qrCode = parsed.code;
      // Algunes versions embolcallen el QR dins de `qrcode`.
      const qrObj = parsed.qrcode as Record<string, unknown> | undefined;
      if (qrObj) {
        if (!pairingCode && typeof qrObj.pairingCode === 'string') pairingCode = qrObj.pairingCode;
        if (!qrBase64 && typeof qrObj.base64 === 'string') qrBase64 = qrObj.base64;
        if (!qrCode && typeof qrObj.code === 'string') qrCode = qrObj.code;
      }
    } catch {
      // body no JSON; el retornem cru igualment
    }

    if (res.ok) {
      console.log('[whatsapp:connect] instance connect', {
        status: res.status,
        hasPairingCode: Boolean(pairingCode),
        hasQr: Boolean(qrBase64 || qrCode),
        body: body.slice(0, 200),
        instance: INSTANCE,
      });
    } else {
      console.error('[whatsapp:connect] non-2xx', {
        status: res.status,
        body: body.slice(0, 300),
        instance: INSTANCE,
      });
    }

    return {
      ok: res.ok,
      status: res.status,
      body: body.slice(0, 2000),
      pairingCode,
      qrBase64,
      qrCode,
    };
  } catch (err) {
    console.error('[whatsapp:connect] threw', { error: String(err), instance: INSTANCE });
    return {
      ok: false,
      status: 0,
      body: String(err),
      pairingCode: null,
      qrBase64: null,
      qrCode: null,
    };
  }
}

// Tanca la sessió (logout) — força que la propera vegada calgui escanejar el QR.
// És l'opció "nuclear" quan `connect` no revifa la sessió. Després de logout,
// crida connect per obtenir un QR net.
//
//   DELETE /instance/logout/{instance}
export async function logoutInstanceRaw(): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (!whatsappConfigured()) {
    return { ok: false, status: 0, body: 'evolution_not_configured' };
  }
  try {
    const res = await evolutionFetch(
      `/instance/logout/${INSTANCE}`,
      { method: 'DELETE', headers: { apikey: API_KEY! } },
      30_000,
    );
    const body = await res.text().catch(() => '');
    if (res.ok) {
      console.log('[whatsapp:logout] instance logged out', {
        status: res.status,
        body: body.slice(0, 200),
        instance: INSTANCE,
      });
    } else {
      console.error('[whatsapp:logout] non-2xx', {
        status: res.status,
        body: body.slice(0, 300),
        instance: INSTANCE,
      });
    }
    return { ok: res.ok, status: res.status, body: body.slice(0, 1000) };
  } catch (err) {
    console.error('[whatsapp:logout] threw', { error: String(err), instance: INSTANCE });
    return { ok: false, status: 0, body: String(err) };
  }
}

// Opció DEFINITIVA quan la instància està en estat zombie (state:open però tot
// falla amb "Connection Closed", i ni logout ni connect la desencallen):
// esborra la instància i la torna a crear amb el MATEIX nom, cosa que força un
// QR completament net. Després cal escanejar-lo amb el telèfon del torneig.
//
//   DELETE /instance/delete/{instance}   (força esborrat de l'estat encallat)
//   POST   /instance/create              (recrea + genera QR nou)
//
// ⚠️ Si Evolution fa servir una apikey PER INSTÀNCIA (no la global), la nova
// instància tindrà una apikey nova (camp `hash`) i caldrà actualitzar
// EVOLUTION_API_KEY. Per això retornem `newApiKey` perquè es vegi al panell.
export type RecreateInstanceResult = {
  ok: boolean;
  deleteStatus: number;
  deleteBody: string;
  createStatus: number;
  createBody: string;
  pairingCode: string | null;
  qrBase64: string | null;
  qrCode: string | null;
  newApiKey: string | null;
};

export async function recreateInstanceRaw(): Promise<RecreateInstanceResult> {
  const empty: RecreateInstanceResult = {
    ok: false,
    deleteStatus: 0,
    deleteBody: '',
    createStatus: 0,
    createBody: '',
    pairingCode: null,
    qrBase64: null,
    qrCode: null,
    newApiKey: null,
  };
  if (!whatsappConfigured()) {
    return { ...empty, deleteBody: 'evolution_not_configured' };
  }

  // 1) Esborrar la instància encallada. Continuem encara que falli: si l'estat
  //    és tan corrupte que el delete peta, el create amb el mateix nom sol
  //    netejar-ho igualment (o retorna "already in use" i caldrà el restart
  //    del contenidor).
  let deleteStatus = 0;
  let deleteBody = '';
  try {
    const delRes = await evolutionFetch(
      `/instance/delete/${INSTANCE}`,
      { method: 'DELETE', headers: { apikey: API_KEY! } },
      30_000,
    );
    deleteStatus = delRes.status;
    deleteBody = (await delRes.text().catch(() => '')).slice(0, 500);
    console.log('[whatsapp:recreate] delete', { status: deleteStatus, body: deleteBody });
  } catch (err) {
    deleteBody = String(err);
    console.error('[whatsapp:recreate] delete threw', { error: String(err) });
  }

  // 2) Recrear la instància amb el mateix nom i demanar QR.
  let createStatus = 0;
  let createBody = '';
  let pairingCode: string | null = null;
  let qrBase64: string | null = null;
  let qrCode: string | null = null;
  let newApiKey: string | null = null;
  try {
    const createRes = await evolutionFetch(
      `/instance/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY! },
        body: JSON.stringify({
          instanceName: INSTANCE,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      },
      30_000,
    );
    createStatus = createRes.status;
    const rawCreate = await createRes.text().catch(() => '');
    createBody = rawCreate.slice(0, 2000);
    try {
      const parsed = JSON.parse(rawCreate) as Record<string, unknown>;
      if (typeof parsed.hash === 'string') newApiKey = parsed.hash;
      else if (parsed.hash && typeof (parsed.hash as Record<string, unknown>).apikey === 'string') {
        newApiKey = (parsed.hash as Record<string, unknown>).apikey as string;
      }
      const qrObj = parsed.qrcode as Record<string, unknown> | undefined;
      if (qrObj) {
        if (typeof qrObj.pairingCode === 'string') pairingCode = qrObj.pairingCode;
        if (typeof qrObj.base64 === 'string') qrBase64 = qrObj.base64;
        if (typeof qrObj.code === 'string') qrCode = qrObj.code;
      }
      if (!qrBase64 && typeof parsed.base64 === 'string') qrBase64 = parsed.base64;
      if (!qrCode && typeof parsed.code === 'string') qrCode = parsed.code;
    } catch {
      // body no JSON
    }
    console.log('[whatsapp:recreate] create', {
      status: createStatus,
      hasQr: Boolean(qrBase64 || qrCode),
      hasNewKey: Boolean(newApiKey),
      body: createBody.slice(0, 200),
    });
  } catch (err) {
    createBody = String(err);
    console.error('[whatsapp:recreate] create threw', { error: String(err) });
  }

  return {
    ok: createStatus >= 200 && createStatus < 300,
    deleteStatus,
    deleteBody,
    createStatus,
    createBody,
    pairingCode,
    qrBase64,
    qrCode,
    newApiKey,
  };
}
