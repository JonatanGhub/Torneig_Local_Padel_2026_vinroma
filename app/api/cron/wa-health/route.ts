import { NextResponse } from 'next/server';
import { checkWhatsAppHealth } from '@/lib/whatsapp/health';

export const dynamic = 'force-dynamic';

// Cron de monitoratge (cada ~30 min). Fa una prova REAL contra Evolution; si
// falla, intenta reiniciar la instància i envia un email d'alerta a
// l'administració. Protegit amb CRON_SECRET (Vercel envia el Bearer).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await checkWhatsAppHealth();
  return NextResponse.json(result);
}
