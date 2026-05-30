'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  UNLOCK_COOKIE,
  UNLOCK_TTL_SECONDS,
  DEVICE_COOKIE,
  signCookie,
  verifyCookie,
} from '@/lib/captain/cookies-edge';
import { verifyPin } from '@/lib/captain/pin';
import { defaultLocale, locales, type Locale } from '@/i18n';

type LoginResult = { ok: boolean; error?: string };

const pinSchema = z.string().regex(/^\d{4}$/);
const nextSchema = z.string().regex(/^\/[A-Za-z0-9_\-/?&=.%:]*$/);

/**
 * Tanca la sessió de Supabase i porta a /login?mode=email perquè l'usuari
 * pugui entrar amb un altre correu (típicament per saltar entre el seu
 * compte personal de capità i el compte admin compartit del club).
 *
 * IMPORTANT: NO esborrem `DEVICE_COOKIE` per defecte — el dispositiu
 * segueix sent de confiança i la propera vegada el capità entrarà amb PIN.
 * Sí esborrem `UNLOCK_COOKIE` perquè la propera entrada exigeixi PIN o
 * magic-link explícit.
 */
export async function signOutAndSwitchAccount(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[signOut] failed', err);
  }

  const cookieStore = await cookies();
  cookieStore.delete(UNLOCK_COOKIE);

  const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = (locales as readonly string[]).includes(fromCookie ?? '')
    ? (fromCookie as Locale)
    : defaultLocale;
  redirect(`/${locale}/login?mode=email`);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function buildCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

async function getLocaleFromCookie(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get('NEXT_LOCALE')?.value;
  if (fromCookie && (locales as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  return defaultLocale;
}

/**
 * Entra al panell de capità amb el PIN del dispositiu (sense magic-link).
 *
 * Fluxe:
 *  1. Llegim DEVICE_COOKIE (HMAC) i busquem el player propietari.
 *  2. Verifiquem el PIN amb players.pin_hash.
 *  3. Generem un magic-link via Admin API (no s'envia per correu) i el
 *     consumim aquí mateix amb verifyOtp() perquè es crei la sessió de
 *     Supabase en cookies, igual com si l'usuari hagués clicat l'enllaç.
 *  4. Estampem UNLOCK_COOKIE i redirigim.
 */
export async function loginWithPin(formData: FormData): Promise<LoginResult> {
  let redirectTo: string | null = null;
  try {
    const rawPin = String(formData.get('pin') ?? '');
    const rawNext = String(formData.get('next') ?? '');

    const pinParsed = pinSchema.safeParse(rawPin);
    if (!pinParsed.success) return { ok: false, error: 'pin_too_short' };

    const cookieStore = await cookies();
    const deviceId = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
    if (!deviceId) return { ok: false, error: 'unlock_new_device' };

    const service = createServiceClient();

    const { data: device } = await service
      .from('captain_devices')
      .select('player_id')
      .eq('device_id', deviceId)
      .maybeSingle();
    if (!device) return { ok: false, error: 'unlock_new_device' };

    const { data: player } = await service
      .from('players')
      .select('id, email, pin_hash')
      .eq('id', device.player_id)
      .maybeSingle();
    if (!player || !player.pin_hash || !player.email) {
      return { ok: false, error: 'no_pin_configured' };
    }

    const pinOk = await verifyPin(pinParsed.data, player.pin_hash);
    if (!pinOk) return { ok: false, error: 'unlock_wrong_pin' };

    // Genera un token mágico (NO se envía email aquí) i el verifiquem
    // immediatament per crear la sessió de Supabase en cookies HTTP.
    const { data: gen, error: genErr } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: player.email,
    });
    if (genErr || !gen?.properties?.hashed_token) {
      console.error('[loginWithPin] generateLink failed', genErr);
      return { ok: false, error: 'session_failed' };
    }

    const ssr = await createClient();
    const { error: verifyErr } = await ssr.auth.verifyOtp({
      type: 'magiclink',
      token_hash: gen.properties.hashed_token,
    });
    if (verifyErr) {
      console.error('[loginWithPin] verifyOtp failed', verifyErr);
      return { ok: false, error: 'session_failed' };
    }

    // Refresca last_used_at i estampa UNLOCK_COOKIE.
    await service
      .from('captain_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('player_id', player.id)
      .eq('device_id', deviceId);

    cookieStore.set(
      UNLOCK_COOKIE,
      await signCookie(String(nowSeconds())),
      buildCookieOptions(UNLOCK_TTL_SECONDS),
    );

    const locale = await getLocaleFromCookie();
    const nextParsed = nextSchema.safeParse(rawNext);
    redirectTo =
      nextParsed.success && nextParsed.data.startsWith('/')
        ? nextParsed.data
        : `/${locale}/captain`;
    return { ok: true };
  } catch (err) {
    console.error('[loginWithPin] unexpected', err);
    return { ok: false, error: 'unexpected' };
  } finally {
    if (redirectTo) redirect(redirectTo);
  }
}
