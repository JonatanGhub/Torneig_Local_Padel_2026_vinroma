import { NextResponse } from 'next/server';
import { notifyWeeklyScheduleToGroup } from '@/lib/whatsapp/notify';
import { whatsappConfigured } from '@/lib/whatsapp/send';

export const dynamic = 'force-dynamic';

// Cron setmanal (Vercel Cron, diumenge 19:00 Madrid). Avisa el grup amb tots
// els partits de dilluns a dijous de la setmana següent, com a complement del
// "Avui es juga" diari (que només mostra el dia en curs).
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

  await notifyWeeklyScheduleToGroup();
  return NextResponse.json({ ok: true });
}
