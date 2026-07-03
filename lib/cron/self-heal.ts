import { after } from 'next/server';
import { runDailyReminderCron, runWeeklyScheduleCron } from '@/lib/whatsapp/notify';
import { whatsappConfigured } from '@/lib/whatsapp/send';

// El pla Hobby de Vercel no garanteix que un cron es dispari a l'hora exacta
// (ni tan sols que es dispari cada dia: hem tingut misses reals del "Avui es
// juga" per causes diferents, un cop per col·lisió amb un deploy i un altre
// sense causa aparent). Com que no podem confiar només en el cron natiu,
// aprofitem el trànsit normal del lloc com a xarxa de seguretat: qualsevol
// visita a una pàgina, un cop passada l'hora oficial, comprova si el job
// d'avui ja s'ha executat i, si no, el dispara ella mateixa.
//
// runDailyReminderCron()/runWeeklyScheduleCron() reclamen un pany a la BD
// (cron_daily_runs) abans d'enviar res, així que no hi ha risc de missatges
// duplicats si el cron real i aquest self-heal coincideixen el mateix dia.
//
// S'invoca amb `after()` perquè mai bloquegi ni alenteixi la resposta a
// l'usuari que ha carregat la pàgina.
export function scheduleSelfHealCrons(): void {
  after(async () => {
    try {
      if (!whatsappConfigured()) return;
      const { hour, weekday } = madridNowParts();

      // Finestra de 2h a partir de l'hora oficial (08:00 Madrid): prou marge
      // perquè el cron real ja hagi corregut, sense deixar la comprovació
      // activa tot el dia a cada visita.
      if (hour >= 8 && hour < 10) {
        await runDailyReminderCron();
      }

      // Cron setmanal oficial: diumenge 19:00 Madrid.
      if (weekday === 'Sun' && hour >= 19 && hour < 21) {
        await runWeeklyScheduleCron();
      }
    } catch (err) {
      console.warn('[cron] self-heal failed', err);
    }
  });
}

function madridNowParts(now: Date = new Date()): { hour: number; weekday: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(now);
    let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    if (hour === 24) hour = 0;
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    return { hour, weekday };
  } catch {
    return { hour: 0, weekday: '' };
  }
}
