import { NextResponse } from 'next/server';
import {
  sendDailyGroupSummary,
  notifyFeePhaseChangeToGroup,
  sendValidationReminders,
} from '@/lib/whatsapp/notify';
import { whatsappConfigured } from '@/lib/whatsapp/send';

export const dynamic = 'force-dynamic';

// Cron diari (Vercel Cron, 08:00 Madrid). Avisos al GRUP i DMs als capitans:
//  1. Resum dels partits que es juguen avui ("Avui es juga ...").
//  2. Si demà canvia el tram de preu de la inscripció, avís d'últim dia.
//  3. DM a ambdós capitans si un partit ja fa >20h que hauria d'estar jugat
//     i el resultat encara no s'ha validat (màxim 7 dies endarrere).
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

  // Recordatori de validació: DM a ambdós capitans si el resultat d'un partit
  // jugat fa >20h encara no s'ha validat. Cada partit rep el recordatori
  // màxim un cop (reminder_sent_at en marca l'enviament).
  const reminders = await sendValidationReminders();

  return NextResponse.json({ ok: true, reminders });
}
