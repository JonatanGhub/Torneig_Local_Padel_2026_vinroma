// =========================================================================
// PIN del capità — hash, verificació i cookies signades.
//
// - Hash: PBKDF2-SHA256, 100k iter, sal 16B, derivat 32B. Format:
//     `pbkdf2$<iter>$<salt_hex>$<hash_hex>`
// - Cookies: `<value>.<hmac_sha256_hex>` amb `AUTH_COOKIE_SECRET` (o fallback
//   derivat de SUPABASE_SERVICE_ROLE_KEY perquè funcioni sense config extra).
// - Sense dependències noves (només `node:crypto`).
// =========================================================================

import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHash,
} from 'node:crypto';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const DIGEST = 'sha256';

export const DEVICE_COOKIE = 'captain_device_id';
export const UNLOCK_COOKIE = 'captain_unlocked_at';
export const UNLOCK_TTL_SECONDS = 24 * 60 * 60; // 1 dia

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = pbkdf2Sync(pin, salt, ITERATIONS, KEY_BYTES, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iter = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(iter) || iter <= 0) return false;
    const salt = Buffer.from(parts[2], 'hex');
    const expected = Buffer.from(parts[3], 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    const derived = pbkdf2Sync(pin, salt, iter, expected.length, DIGEST);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function getSecret(): string {
  const direct = process.env.AUTH_COOKIE_SECRET;
  if (direct && direct.length > 0) return direct;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service && service.length > 0) {
    return createHash('sha256').update(service).digest('hex');
  }
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createHash('sha256').update(`fallback:${anon}`).digest('hex');
}

export function signCookie(value: string): string {
  const sig = createHmac('sha256', getSecret()).update(value).digest('hex');
  return `${value}.${sig}`;
}

export function verifyCookie(signed: string | undefined): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const provided = signed.slice(idx + 1);
  const expected = createHmac('sha256', getSecret()).update(value).digest('hex');
  if (provided.length !== expected.length) return null;
  try {
    const ok = timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
    return ok ? value : null;
  } catch {
    return null;
  }
}

export function newDeviceId(): string {
  return randomUUID();
}
