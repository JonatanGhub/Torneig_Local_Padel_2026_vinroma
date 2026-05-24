/**
 * Cliente mínimo para Evolution API (WhatsApp self-hosted).
 *
 * Config por variables de entorno (NUNCA hardcodear la apikey):
 *   EVOLUTION_API_URL    p.ej. https://evo.neonexai.com
 *   EVOLUTION_API_KEY    apikey global de la instancia
 *   EVOLUTION_INSTANCE   nombre de la instance con el número conectado
 *
 * Si falta cualquiera, sendWhatsApp es un no-op (igual que sendEmail sin
 * RESEND_API_KEY). Nunca lanza: un fallo de WhatsApp no debe romper la
 * mutación principal (resultado, reschedule, etc.).
 */

const API_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? null;
const API_KEY = process.env.EVOLUTION_API_KEY ?? null;
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? null;

export function whatsappConfigured(): boolean {
  return Boolean(API_URL && API_KEY && INSTANCE);
}

/**
 * Normaliza un teléfono español a formato Evolution (dígitos con prefijo país,
 * sin '+'). Devuelve null si no parece un número válido.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('34') && digits.length === 11) return digits; // 34 + 9
  if (digits.length === 9) return `34${digits}`; // móvil/fijo nacional
  if (digits.length >= 11) return digits; // ya internacional
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
      // Formato Evolution API v2. Si tu versión usa otro esquema, ajústalo aquí.
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Evolution API ${res.status}: ${body.slice(0, 200)}`);
    }
    return { ok: true, skipped: false };
  } catch (err) {
    console.warn('[whatsapp] send failed', err);
    return { ok: false, skipped: false, error: String(err) };
  }
}
