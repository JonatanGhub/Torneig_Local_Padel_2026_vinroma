import { NextResponse } from 'next/server';
import { sendDailyGroupSummary, notifyFeePhaseChangeToGroup } from '@/lib/whatsapp/notify';
import { whatsappConfigured } from '@/lib/whatsapp/send';

export const dynamic = 'force-dynamic';

// Cron diari (Vercel Cron, 09:00 Madrid). Avisos al GRUP de WhatsApp:
//  1. Resum dels partits que es juguen avui ("Avui es juga ...").
//  2. Si demà canvia el tram de preu de la inscripció, avís d'últim dia.
//
// Els capitans NO reben DM de recordatori diari: el resum del grup ja ho
// cobreix. Els DMs als capitans queden per als events dels SEUS partits
// (programació, canvis d'horari, resultats per validar...).
//
// Protegit amb CRON_SECRET (Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!whatsappConfigured()) {
    return NextResponse.json({ ok: true, reason: 'whatsapp_not_configured' });
  }

  // Resum diari al grup: "Avui es juga ...". No-op si no hi ha partits avui
  // o si WHATSAPP_GROUP_JID no està definit.
  await sendDailyGroupSummary();

  // Últim dia al preu actual (si demà comença un tram nou de tarifa).
  await notifyFeePhaseChangeToGroup();

  return NextResponse.json({ ok: true });
}
