import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyMatchReminderWhatsApp } from '@/lib/whatsapp/notify';
import { whatsappConfigured } from '@/lib/whatsapp/send';

export const dynamic = 'force-dynamic';

// Cron diari (Vercel Cron). Envia recordatori de WhatsApp dels partits
// programats a les pròximes 24 h que encara no s'hagin recordat.
// Protegit amb CRON_SECRET (Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Si WhatsApp no està configurat, no "consumim" els recordatoris (no marquem
  // reminder_sent_at), perquè s'enviïn quan s'activi Evolution.
  if (!whatsappConfigured()) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'whatsapp_not_configured' });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in24h.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  for (const m of matches ?? []) {
    await notifyMatchReminderWhatsApp(m.id);
    await supabase
      .from('matches')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', m.id);
    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
