// =========================================================================
// Cookies signades del capità (Edge-compatible).
//
// Aquest fitxer NO pot importar res de `node:*` perquè s'utilitza des de
// middleware.ts (runtime Edge). Fa servir Web Crypto API (`crypto.subtle`)
// disponible tant a Edge com a Node modern.
//
// Format del valor signat: `<value>.<hmac_sha256_hex>`.
// Secret: AUTH_COOKIE_SECRET (env) o fallback derivat de
// SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY.
// =========================================================================

export const DEVICE_COOKIE = 'captain_device_id';
export const UNLOCK_COOKIE = 'captain_unlocked_at';
export const UNLOCK_TTL_SECONDS = 24 * 60 * 60; // 1 dia

const enc = new TextEncoder();

function getSecretString(): string {
  const direct = process.env.AUTH_COOKIE_SECRET;
  if (direct && direct.length > 0) return direct;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service && service.length > 0) return `srv:${service}`;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return `fallback:${anon}`;
}

async function getKey(): Promise<CryptoKey> {
  // Derivem 32B SHA-256 del secret per tenir una clau de longitud estable.
  const hashed = await crypto.subtle.digest('SHA-256', encodeUtf8(getSecretString()));
  return crypto.subtle.importKey('raw', hashed, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

// Garanteix que el resultat té un ArrayBuffer (no SharedArrayBuffer) per
// satisfer els tipus de BufferSource de Web Crypto.
function fromHex(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) return new ArrayBuffer(0);
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(byte)) return new ArrayBuffer(0);
    bytes[i] = byte;
  }
  return buf;
}

function encodeUtf8(value: string): ArrayBuffer {
  const u8 = enc.encode(value);
  // Re-empaquetem en un ArrayBuffer fresc per evitar Uint8Array<ArrayBufferLike>.
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

export async function signCookie(value: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, encodeUtf8(value));
  return `${value}.${toHex(sig)}`;
}

export async function verifyCookie(signed: string | undefined): Promise<string | null> {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const provided = signed.slice(idx + 1);
  const sigBuf = fromHex(provided);
  if (sigBuf.byteLength === 0) return null;
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify('HMAC', key, sigBuf, encodeUtf8(value));
    return ok ? value : null;
  } catch {
    return null;
  }
}

export function newDeviceId(): string {
  // Web Crypto API exposes crypto.randomUUID() in Edge and modern Node.
  return crypto.randomUUID();
}
