'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hashPin, verifyPin } from '@/lib/captain/pin';
import {
  DEVICE_COOKIE,
  UNLOCK_COOKIE,
  UNLOCK_TTL_SECONDS,
  newDeviceId,
  signCookie,
  verifyCookie,
} from '@/lib/captain/cookies-edge';
import { defaultLocale, locales, type Locale } from '@/i18n';

type ActionResult = { ok: boolean; error?: string };

const pinSchema = z.string().regex(/^\d{4}$/);
const labelSchema = z.string().trim().min(0).max(64);
const nextSchema = z.string().regex(/^\/[A-Za-z0-9_\-/?&=.%:]*$/);

async function getLocaleFromCookie(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get('NEXT_LOCALE')?.value;
  if (fromCookie && (locales as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  return defaultLocale;
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

export async function setPin(formData: FormData): Promise<ActionResult> {
  let redirectTo: string | null = null;
  try {
    const rawPin = String(formData.get('pin') ?? '');
    const rawRepeat = String(formData.get('pin_repeat') ?? '');
    const rawLabel = String(formData.get('label') ?? '');
    const rawNext = String(formData.get('next') ?? '');

    const pinParsed = pinSchema.safeParse(rawPin);
    if (!pinParsed.success) return { ok: false, error: 'pin_too_short' };
    if (rawPin !== rawRepeat) return { ok: false, error: 'pin_mismatch' };
    const labelParsed = labelSchema.safeParse(rawLabel);
    const label = labelParsed.success && labelParsed.data.length > 0 ? labelParsed.data : null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'unauthenticated' };

    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (playerErr || !player) return { ok: false, error: 'no_player' };

    const hash = await hashPin(pinParsed.data);
    const { error: updateErr } = await supabase
      .from('players')
      .update({ pin_hash: hash })
      .eq('id', player.id);
    if (updateErr) {
      console.error('[setPin] update players failed', updateErr);
      return { ok: false, error: 'update_failed' };
    }

    const cookieStore = await cookies();
    const existingDeviceId = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
    const deviceId = existingDeviceId ?? newDeviceId();

    const { error: deviceErr } = await supabase.from('captain_devices').upsert(
      {
        player_id: player.id,
        device_id: deviceId,
        device_label: label,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,device_id' },
    );
    if (deviceErr) {
      console.error('[setPin] upsert captain_devices failed', deviceErr);
      return { ok: false, error: 'device_failed' };
    }

    cookieStore.set(
      DEVICE_COOKIE,
      await signCookie(deviceId),
      buildCookieOptions(60 * 60 * 24 * 365),
    );
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
    console.error('[setPin] unexpected', err);
    return { ok: false, error: 'unexpected' };
  } finally {
    if (redirectTo) redirect(redirectTo);
  }
}

export async function verifyAndUnlock(formData: FormData): Promise<ActionResult> {
  let redirectTo: string | null = null;
  try {
    const rawPin = String(formData.get('pin') ?? '');
    const rawNext = String(formData.get('next') ?? '');

    const pinParsed = pinSchema.safeParse(rawPin);
    if (!pinParsed.success) return { ok: false, error: 'unlock_wrong_pin' };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'unauthenticated' };

    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('id, pin_hash')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (playerErr || !player || !player.pin_hash) return { ok: false, error: 'no_player' };

    const cookieStore = await cookies();
    const deviceId = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
    if (!deviceId) return { ok: false, error: 'unlock_new_device' };

    const { data: device } = await supabase
      .from('captain_devices')
      .select('id')
      .eq('player_id', player.id)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (!device) return { ok: false, error: 'unlock_new_device' };

    const ok = await verifyPin(pinParsed.data, player.pin_hash);
    if (!ok) return { ok: false, error: 'unlock_wrong_pin' };

    cookieStore.set(
      UNLOCK_COOKIE,
      await signCookie(String(nowSeconds())),
      buildCookieOptions(UNLOCK_TTL_SECONDS),
    );
    await supabase
      .from('captain_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', device.id);

    const locale = await getLocaleFromCookie();
    const nextParsed = nextSchema.safeParse(rawNext);
    redirectTo =
      nextParsed.success && nextParsed.data.startsWith('/')
        ? nextParsed.data
        : `/${locale}/captain`;
    return { ok: true };
  } catch (err) {
    console.error('[verifyAndUnlock] unexpected', err);
    return { ok: false, error: 'unexpected' };
  } finally {
    if (redirectTo) redirect(redirectTo);
  }
}

export async function trustThisDevice(formData: FormData): Promise<{ ok: boolean }> {
  try {
    const rawLabel = String(formData.get('label') ?? '');
    const labelParsed = labelSchema.safeParse(rawLabel);
    const label = labelParsed.success && labelParsed.data.length > 0 ? labelParsed.data : null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!player) return { ok: false };

    const cookieStore = await cookies();
    const existingDeviceId = await verifyCookie(cookieStore.get(DEVICE_COOKIE)?.value);
    const deviceId = existingDeviceId ?? newDeviceId();

    const { error } = await supabase.from('captain_devices').upsert(
      {
        player_id: player.id,
        device_id: deviceId,
        device_label: label,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,device_id' },
    );
    if (error) {
      console.error('[trustThisDevice] upsert failed', error);
      return { ok: false };
    }

    cookieStore.set(
      DEVICE_COOKIE,
      await signCookie(deviceId),
      buildCookieOptions(60 * 60 * 24 * 365),
    );
    return { ok: true };
  } catch (err) {
    console.error('[trustThisDevice] unexpected', err);
    return { ok: false };
  }
}
