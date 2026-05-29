// =========================================================================
// Hash i verificació de PIN del capità — només per a server actions (Node).
//
// Aquest fitxer NO és Edge-compatible (usa node:crypto pel PBKDF2). No
// l'importis des de middleware. Per a cookies signades, fes servir
// `lib/captain/cookies-edge.ts`.
//
// Hash format: `pbkdf2$<iter>$<salt_hex>$<hash_hex>`.
// =========================================================================

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const DIGEST = 'sha256';

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = pbkdf2Sync(pin, salt, ITERATIONS, KEY_BYTES, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const [, iterStr, saltHex, hashHex] = parts;
    if (!iterStr || !saltHex || !hashHex) return false;
    const iter = Number.parseInt(iterStr, 10);
    if (!Number.isFinite(iter) || iter <= 0) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    const derived = pbkdf2Sync(pin, salt, iter, expected.length, DIGEST);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
