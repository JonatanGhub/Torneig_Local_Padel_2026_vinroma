import { NextResponse } from 'next/server';
import { runWeeklyScheduleCron } from '@/lib/whatsapp/notify';

export const dynamic = 'force-dynamic';

// Cron setmanal (Vercel Cron, diumenge 19:00 Madrid). Avisa el grup amb tots
// els partits de la setmana següent sencera (dilluns a diumenge, incloent
// partits reprogramats fora de l'horari oficial), com a complement del
// "Avui es juga" diari (que només mostra el dia en curs).
//
// Igual que match-reminders, lib/cron/self-heal.ts pot disparar aquesta
// mateixa feina des del trànsit del lloc si el cron real no s'ha executat;
// runWeeklyScheduleCron() és idempotent (cron_daily_runs).
//
// Protegit amb CRON_SECRET (Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runWeeklyScheduleCron();
  return NextResponse.json({ ok: true, ...result });
}
