import { NextResponse } from 'next/server';
import { runDailyReminderCron } from '@/lib/whatsapp/notify';

export const dynamic = 'force-dynamic';

// Cron diari (Vercel Cron, 08:00 Madrid). Avisos al GRUP i DMs als capitans:
//  1. Resum dels partits que es juguen avui ("Avui es juga ...").
//  2. Si demà canvia el tram de preu de la inscripció, avís d'últim dia.
//  3. DM a ambdós capitans si un partit ja fa >20h que hauria d'estar jugat
//     i el resultat encara no s'ha validat (màxim 7 dies endarrere).
//  4. DM al capità que ha de respondre una proposta de canvi de data que
//     porta >24h pendent.
//
// El pla Hobby de Vercel no garanteix la sincronia horària dels crons (hem
// tingut misses reals), així que aquesta mateixa feina també la dispara
// lib/cron/self-heal.ts des del trànsit normal del lloc si detecta que no
// s'ha executat avui. runDailyReminderCron() és idempotent (cron_daily_runs)
// per evitar missatges duplicats si ambdós es disparen el mateix dia.
//
// Protegit amb CRON_SECRET (Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runDailyReminderCron();
  return NextResponse.json({ ok: true, ...result });
}
